import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import IORedis, { type Redis } from "ioredis";
import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "@/app.module";
import {
  GOOGLE_ID_TOKEN_VERIFIER_OPTIONS,
  type GoogleIdTokenVerifierOptions,
} from "@/auth/services/google-id-token-verifier";
import { Transaction } from "@/cashflow/entities/transaction.entity";

const ISSUER = "https://test-issuer.example.com";
const AUDIENCE = "test-client-id";
const NONCE = "test-nonce";

describe("Cashflow integration", () => {
  let container: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer | null;
  let redisAdmin: Redis;
  let app: INestApplication;
  let dataSource: DataSource;
  let signingPrivateKey: CryptoKey;
  let publicJwk: JWK;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine")
      .withDatabase("fortuna_test")
      .withUsername("fortuna")
      .withPassword("fortuna")
      .start();
    process.env.POSTGRES_HOST = container.getHost();
    process.env.POSTGRES_PORT = String(container.getMappedPort(5432));
    process.env.POSTGRES_DB = container.getDatabase();
    process.env.POSTGRES_USER = container.getUsername();
    process.env.POSTGRES_PASSWORD = container.getPassword();
    process.env.POSTGRES_SSL = "false";

    redisContainer = await new RedisContainer("redis:7-alpine")
      .withPassword("fortuna")
      .start();
    process.env.REDIS_HOST = redisContainer.getHost();
    process.env.REDIS_PORT = String(redisContainer.getPort());
    process.env.REDIS_PASSWORD = redisContainer.getPassword();
    redisAdmin = new IORedis({
      host: redisContainer.getHost(),
      port: redisContainer.getPort(),
      password: redisContainer.getPassword(),
      maxRetriesPerRequest: 1,
    });
    redisAdmin.on("connect", () => redisAdmin.stream?.unref());

    const keyPair = await generateKeyPair("RS256");
    signingPrivateKey = keyPair.privateKey;
    const jwk = await exportJWK(keyPair.publicKey);
    jwk.alg = "RS256";
    jwk.use = "sig";
    jwk.kid = "test-kid";
    publicJwk = jwk;

    const verifierOptions: GoogleIdTokenVerifierOptions = {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: { keys: [publicJwk] },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_ID_TOKEN_VERIFIER_OPTIONS)
      .useValue(verifierOptions)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await redisAdmin?.quit().catch(() => undefined);
    redisAdmin?.disconnect(false);
    await redisContainer?.stop();
    await container?.stop();
  });

  beforeEach(async () => {
    if (!dataSource) return;
    await dataSource.query(
      'TRUNCATE TABLE "transactions", "user_settings", "sign_in_events", "sessions", "device_fingerprints", "identities", "users" RESTART IDENTITY CASCADE',
    );
    if (redisAdmin?.status === "ready" || redisAdmin?.status === "connect") {
      await redisAdmin.flushdb().catch(() => undefined);
    }
  });

  async function signInUser(profile: {
    sub: string;
    name: string;
    email: string;
  }): Promise<{ cookie: string }> {
    const now = Math.floor(Date.now() / 1000);
    const idToken = await new SignJWT({
      nonce: NONCE,
      name: profile.name,
      email: profile.email,
      picture: "https://example.com/a.png",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(profile.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .sign(signingPrivateKey);

    const res = await request(app.getHttpServer())
      .post("/auth/google")
      .send({ idToken, nonce: NONCE })
      .expect(201);
    return { cookie: `fortuna_session=${res.body.sessionToken}` };
  }

  describe("GET/PUT /users/me/base-currency", () => {
    it("defaults to USD when the user has not chosen a base currency", async () => {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });

      const res = await request(app.getHttpServer())
        .get("/users/me/base-currency")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toEqual({ baseCurrency: "USD" });
    });

    it("persists the chosen code and round-trips it on read", async () => {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });

      await request(app.getHttpServer())
        .put("/users/me/base-currency")
        .set("Cookie", cookie)
        .send({ baseCurrency: "EUR" })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get("/users/me/base-currency")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toEqual({ baseCurrency: "EUR" });
    });

    it("overwrites an existing base currency on a second PUT", async () => {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });

      await request(app.getHttpServer())
        .put("/users/me/base-currency")
        .set("Cookie", cookie)
        .send({ baseCurrency: "USD" })
        .expect(200);
      await request(app.getHttpServer())
        .put("/users/me/base-currency")
        .set("Cookie", cookie)
        .send({ baseCurrency: "BRL" })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get("/users/me/base-currency")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toEqual({ baseCurrency: "BRL" });
    });

    it("rejects a malformed ISO 4217 code", async () => {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });

      await request(app.getHttpServer())
        .put("/users/me/base-currency")
        .set("Cookie", cookie)
        .send({ baseCurrency: "dollar" })
        .expect(400);
    });
  });

  describe("POST /transactions", () => {
    it("persists and returns the row using the USD default when the user has not chosen one", async () => {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });

      const res = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "12.34",
          currency: "USD",
          description: "Lunch",
          kind: "expense",
        })
        .expect(201);

      expect(res.body.transaction).toEqual({
        id: expect.any(String),
        date: "2026-06-07",
        amount: "12.34",
        currency: "USD",
        description: "Lunch",
        kind: "expense",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const rows = await dataSource.getRepository(Transaction).find();
      expect(rows).toHaveLength(1);
    });

    it("rejects malformed DTO fields with 400", async () => {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });

      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "07/06/2026",
          amount: "12.345",
          currency: "usd",
          description: "",
          kind: "transfer",
        })
        .expect(400);
    });
  });

  describe("GET /transactions", () => {
    async function bootstrappedUser(email: string, sub: string) {
      const { cookie } = await signInUser({
        sub,
        name: email,
        email,
      });
      return cookie;
    }

    async function captureTransaction(
      cookie: string,
      overrides: Partial<{
        date: string;
        amount: string;
        currency: string;
        description: string;
        kind: "income" | "expense";
      }> = {},
    ) {
      const body = {
        date: "2026-06-07",
        amount: "10.00",
        currency: "USD",
        description: "row",
        kind: "expense" as const,
        ...overrides,
      };
      return request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send(body)
        .expect(201);
    }

    it("returns the user's transactions newest-first by date then id", async () => {
      const cookie = await bootstrappedUser("alice@example.com", "sub-a");
      await captureTransaction(cookie, {
        date: "2026-06-01",
        description: "a",
      });
      await captureTransaction(cookie, {
        date: "2026-06-07",
        description: "c",
      });
      await captureTransaction(cookie, {
        date: "2026-06-05",
        description: "b",
      });

      const res = await request(app.getHttpServer())
        .get("/transactions")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.items.map((t: { date: string }) => t.date)).toEqual([
        "2026-06-07",
        "2026-06-05",
        "2026-06-01",
      ]);
      expect(res.body.nextCursor).toBeNull();
    });

    it("paginates by keyset and walks every row across two pages", async () => {
      const cookie = await bootstrappedUser("alice@example.com", "sub-a");
      for (let day = 1; day <= 6; day += 1) {
        await captureTransaction(cookie, {
          date: `2026-06-0${day}`,
          description: `row-${day}`,
        });
      }

      const first = await request(app.getHttpServer())
        .get("/transactions?limit=4")
        .set("Cookie", cookie)
        .expect(200);
      expect(first.body.items).toHaveLength(4);
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await request(app.getHttpServer())
        .get(`/transactions?limit=4&cursor=${first.body.nextCursor}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(second.body.items).toHaveLength(2);
      expect(second.body.nextCursor).toBeNull();

      const allIds = [
        ...first.body.items.map((t: { id: string }) => t.id),
        ...second.body.items.map((t: { id: string }) => t.id),
      ];
      expect(new Set(allIds).size).toBe(6);
    });

    it("rejects a malformed cursor with 400", async () => {
      const cookie = await bootstrappedUser("alice@example.com", "sub-a");

      await request(app.getHttpServer())
        .get("/transactions?cursor=not-a-cursor")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("never leaks another user's rows through the list endpoint", async () => {
      const aliceCookie = await bootstrappedUser("alice@example.com", "sub-a");
      const bobCookie = await bootstrappedUser("bob@example.com", "sub-b");
      await captureTransaction(aliceCookie, { description: "alice-1" });
      await captureTransaction(aliceCookie, { description: "alice-2" });
      await captureTransaction(bobCookie, { description: "bob-1" });

      const aliceRes = await request(app.getHttpServer())
        .get("/transactions")
        .set("Cookie", aliceCookie)
        .expect(200);
      const bobRes = await request(app.getHttpServer())
        .get("/transactions")
        .set("Cookie", bobCookie)
        .expect(200);

      expect(
        aliceRes.body.items.map((t: { description: string }) => t.description),
      ).toEqual(expect.arrayContaining(["alice-1", "alice-2"]));
      expect(
        aliceRes.body.items.some(
          (t: { description: string }) => t.description === "bob-1",
        ),
      ).toBe(false);
      expect(
        bobRes.body.items.map((t: { description: string }) => t.description),
      ).toEqual(["bob-1"]);
    });
  });

  describe("erasure: deleting a user removes their cashflow rows", () => {
    it("cascades transactions and user_settings on user delete", async () => {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });
      await request(app.getHttpServer())
        .put("/users/me/base-currency")
        .set("Cookie", cookie)
        .send({ baseCurrency: "USD" })
        .expect(200);
      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "Lunch",
          kind: "expense",
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete("/users/me")
        .set("Cookie", cookie)
        .send({ confirm: true })
        .expect(204);

      const txCount = await dataSource.getRepository(Transaction).count();
      expect(txCount).toBe(0);
      const settingsCount = await dataSource.query(
        'SELECT COUNT(*)::int AS c FROM "user_settings"',
      );
      expect(settingsCount[0].c).toBe(0);
    });
  });
});
