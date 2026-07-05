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
import { Tag } from "@/cashflow/entities/tag.entity";
import { Transaction } from "@/cashflow/entities/transaction.entity";
import { TransactionTag } from "@/cashflow/entities/transaction-tag.entity";
import { assignColor } from "@/cashflow/tag-colors";
import { FxRate } from "@/fx/entities/fx-rate.entity";
import {
  FX_FETCH_RETRY_OPTIONS,
  FX_FRANKFURTER_CLIENT,
} from "@/fx/services/fx-fetch.service";
import { FxScheduledJob } from "@/fx/services/fx-scheduled-job";

const ISSUER = "https://test-issuer.example.com";
const AUDIENCE = "test-client-id";
const NONCE = "test-nonce";

interface FxClientStub {
  fetchHistoricalEurAnchored: jest.Mock;
}

describe("Cashflow integration", () => {
  let container: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer | null;
  let redisAdmin: Redis;
  let app: INestApplication;
  let dataSource: DataSource;
  let signingPrivateKey: CryptoKey;
  let publicJwk: JWK;
  let fxClientStub: FxClientStub;

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

    fxClientStub = {
      fetchHistoricalEurAnchored: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_ID_TOKEN_VERIFIER_OPTIONS)
      .useValue(verifierOptions)
      .overrideProvider(FX_FRANKFURTER_CLIENT)
      .useValue(fxClientStub)
      .overrideProvider(FX_FETCH_RETRY_OPTIONS)
      .useValue({
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 1,
        sleep: () => Promise.resolve(),
      })
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
      'TRUNCATE TABLE "transaction_tags", "tags", "transactions", "user_settings", "sign_in_events", "sessions", "device_fingerprints", "identities", "users", "fx_rates", "fx_coverage" RESTART IDENTITY CASCADE',
    );
    if (redisAdmin?.status === "ready" || redisAdmin?.status === "connect") {
      await redisAdmin.flushdb().catch(() => undefined);
    }
    fxClientStub.fetchHistoricalEurAnchored.mockReset();
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

      expect(res.body.transactions).toHaveLength(1);
      expect(res.body.transactions[0]).toEqual({
        id: expect.any(String),
        date: "2026-06-07",
        amount: "12.34",
        currency: "USD",
        description: "Lunch",
        kind: "expense",
        tagIds: [],
        baseAmount: "12.34",
        baseCurrency: "USD",
        rateSubstituted: false,
        rateDate: "2026-06-07",
        unconvertible: false,
        group: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(res.body.transactions[0]).not.toHaveProperty("categoryId");

      const rows = await dataSource.getRepository(Transaction).find();
      expect(rows).toHaveLength(1);
    });

    it("rejects an unknown categoryId body field with 400", async () => {
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
          categoryId: "11111111-1111-4111-8111-111111111111",
        })
        .expect(400);
      expect(JSON.stringify(res.body)).toMatch(/categoryId/);
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

  describe("/tags CRUD", () => {
    async function aliceCookie(): Promise<string> {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });
      return cookie;
    }

    it("creates, lists, renames, and deletes user-scoped tags", async () => {
      const cookie = await aliceCookie();
      const created = await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "travel" })
        .expect(201);
      const id = created.body.tag.id as string;
      expect(created.body.tag.color).toBe(assignColor("travel"));

      const renamed = await request(app.getHttpServer())
        .patch(`/tags/${id}`)
        .set("Cookie", cookie)
        .send({ name: "vacation" })
        .expect(200);
      expect(renamed.body.tag.name).toBe("vacation");
      // Rename preserves the original auto-assigned color.
      expect(renamed.body.tag.color).toBe(assignColor("travel"));

      await request(app.getHttpServer())
        .delete(`/tags/${id}`)
        .set("Cookie", cookie)
        .expect(204);
      const after = await request(app.getHttpServer())
        .get("/tags")
        .set("Cookie", cookie)
        .expect(200);
      expect(after.body.items).toHaveLength(0);
    });

    it("auto-assigns a palette-key color on POST /tags matching assignColor(name)", async () => {
      const cookie = await aliceCookie();
      const res = await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "groceries" })
        .expect(201);
      expect(res.body.tag.color).toBe(assignColor("groceries"));

      const list = await request(app.getHttpServer())
        .get("/tags")
        .set("Cookie", cookie)
        .expect(200);
      expect(list.body.items[0].color).toBe(assignColor("groceries"));
    });

    it("rejects POST /tags with a body color property (whitelisted DTO)", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "travel", color: "amber" })
        .expect(400);
    });

    it("persists a new color on PATCH /tags/:id with a valid palette key", async () => {
      const cookie = await aliceCookie();
      const created = await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "travel" })
        .expect(201);
      const id = created.body.tag.id as string;

      const patched = await request(app.getHttpServer())
        .patch(`/tags/${id}`)
        .set("Cookie", cookie)
        .send({ color: "emerald" })
        .expect(200);
      expect(patched.body.tag.color).toBe("emerald");

      const list = await request(app.getHttpServer())
        .get("/tags")
        .set("Cookie", cookie)
        .expect(200);
      expect(list.body.items[0].color).toBe("emerald");
    });

    it("rejects PATCH /tags/:id with an unknown color key and leaves the row unchanged", async () => {
      const cookie = await aliceCookie();
      const created = await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "travel" })
        .expect(201);
      const id = created.body.tag.id as string;
      const originalColor = created.body.tag.color as string;

      await request(app.getHttpServer())
        .patch(`/tags/${id}`)
        .set("Cookie", cookie)
        .send({ color: "bogus" })
        .expect(400);

      const row = await dataSource
        .getRepository(Tag)
        .findOneOrFail({ where: { id } });
      expect(row.color).toBe(originalColor);
    });

    it("rejects an empty PATCH body with 400", async () => {
      const cookie = await aliceCookie();
      const created = await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "travel" })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/tags/${created.body.tag.id}`)
        .set("Cookie", cookie)
        .send({})
        .expect(400);
    });

    it("returns 404 when patching a tag owned by another user", async () => {
      const aliceC = await aliceCookie();
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });
      const bobTag = await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", bobC)
        .send({ name: "bob-tag" })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/tags/${bobTag.body.tag.id}`)
        .set("Cookie", aliceC)
        .send({ color: "amber" })
        .expect(404);
    });

    it("rejects a duplicate tag on create with 409", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "travel" })
        .expect(201);
      await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "travel" })
        .expect(409);
    });

    it("detaches the tag from every linked transaction on delete; transactions remain", async () => {
      const cookie = await aliceCookie();
      const tx = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
          tagNames: ["travel", "lisbon"],
        })
        .expect(201);
      expect(tx.body.transactions[0].tagIds).toHaveLength(2);

      const tagsList = await request(app.getHttpServer())
        .get("/tags")
        .set("Cookie", cookie)
        .expect(200);
      const travel = tagsList.body.items.find(
        (t: { name: string }) => t.name === "travel",
      );

      await request(app.getHttpServer())
        .delete(`/tags/${travel.id}`)
        .set("Cookie", cookie)
        .expect(204);

      const reread = await request(app.getHttpServer())
        .get("/transactions")
        .set("Cookie", cookie)
        .expect(200);
      expect(reread.body.items[0].tagIds).toHaveLength(1);
      const txCount = await dataSource.getRepository(Transaction).count();
      expect(txCount).toBe(1);
      const joinCount = await dataSource.getRepository(TransactionTag).count();
      expect(joinCount).toBe(1);
    });

    it("never leaks another user's tags through the list endpoint", async () => {
      const aliceC = await aliceCookie();
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });
      await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", aliceC)
        .send({ name: "alice-tag" })
        .expect(201);
      await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", bobC)
        .send({ name: "bob-tag" })
        .expect(201);

      const aliceList = await request(app.getHttpServer())
        .get("/tags")
        .set("Cookie", aliceC)
        .expect(200);
      expect(
        aliceList.body.items.some(
          (t: { name: string }) => t.name === "bob-tag",
        ),
      ).toBe(false);
    });
  });

  describe("POST /transactions with tags", () => {
    async function aliceCookie(): Promise<string> {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });
      return cookie;
    }

    it("resolves a mix of existing and new tag names in one DB transaction", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name: "travel" })
        .expect(201);

      const tx = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
          tagNames: ["travel", "lisbon"],
        })
        .expect(201);
      expect(tx.body.transactions[0].tagIds).toHaveLength(2);
      expect(tx.body.transactions[0]).not.toHaveProperty("categoryId");

      const tags = await dataSource.getRepository(Tag).find({
        order: { name: "ASC" },
      });
      expect(tags.map((t) => t.name)).toEqual(["lisbon", "travel"]);
      // Implicit creation auto-assigns a color by the same rule.
      expect(tags.map((t) => t.color)).toEqual([
        assignColor("lisbon"),
        assignColor("travel"),
      ]);
      // Backfill invariant: no row ever escapes without a color.
      const nulls = await dataSource
        .getRepository(Tag)
        .createQueryBuilder("t")
        .where("t.color IS NULL")
        .getCount();
      expect(nulls).toBe(0);
    });
  });

  describe("PATCH /transactions/:id", () => {
    async function aliceCookie(): Promise<string> {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });
      return cookie;
    }

    it("reconciles tag names, swapping the link set wholesale", async () => {
      const cookie = await aliceCookie();
      const tx = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
          tagNames: ["travel", "lisbon"],
        })
        .expect(201);

      const patched = await request(app.getHttpServer())
        .patch(`/transactions/${tx.body.transactions[0].id}`)
        .set("Cookie", cookie)
        .send({ tagNames: ["lisbon", "food"] })
        .expect(200);
      expect(patched.body.transaction.tagIds).toHaveLength(2);

      const tagsForTx = await dataSource
        .getRepository(TransactionTag)
        .count({ where: { transactionId: tx.body.transactions[0].id } });
      expect(tagsForTx).toBe(2);

      const allTags = await dataSource.getRepository(Tag).find();
      expect(allTags.map((t) => t.name).sort()).toEqual([
        "food",
        "lisbon",
        "travel",
      ]);
    });

    it("changes the kind and amount and never emits a categoryId on the response", async () => {
      const cookie = await aliceCookie();
      const tx = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
        })
        .expect(201);

      const patched = await request(app.getHttpServer())
        .patch(`/transactions/${tx.body.transactions[0].id}`)
        .set("Cookie", cookie)
        .send({ kind: "income", amount: "20.00" })
        .expect(200);
      expect(patched.body.transaction.kind).toBe("income");
      expect(patched.body.transaction.amount).toBe("20.00");
      expect(patched.body.transaction).not.toHaveProperty("categoryId");
    });

    it("rejects an unknown categoryId body field with 400", async () => {
      const cookie = await aliceCookie();
      const tx = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/transactions/${tx.body.transactions[0].id}`)
        .set("Cookie", cookie)
        .send({ categoryId: "11111111-1111-4111-8111-111111111111" })
        .expect(400);
      expect(JSON.stringify(res.body)).toMatch(/categoryId/);
    });

    it("returns 404 when patching another user's transaction", async () => {
      const aliceC = await aliceCookie();
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });
      const tx = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", bobC)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/transactions/${tx.body.transactions[0].id}`)
        .set("Cookie", aliceC)
        .send({ description: "hijack" })
        .expect(404);
    });
  });

  describe("DELETE /transactions/:id", () => {
    async function aliceCookie(): Promise<string> {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });
      return cookie;
    }

    it("removes the transaction and cascades its tag join rows", async () => {
      const cookie = await aliceCookie();
      const tx = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
          tagNames: ["travel"],
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/transactions/${tx.body.transactions[0].id}`)
        .set("Cookie", cookie)
        .expect(204);

      expect(await dataSource.getRepository(Transaction).count()).toBe(0);
      expect(await dataSource.getRepository(TransactionTag).count()).toBe(0);
      expect(await dataSource.getRepository(Tag).count()).toBe(1);
    });

    it("returns 404 when deleting another user's transaction", async () => {
      const aliceC = await aliceCookie();
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });
      const tx = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", bobC)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/transactions/${tx.body.transactions[0].id}`)
        .set("Cookie", aliceC)
        .expect(404);
    });
  });

  describe("FX read-time conversion on GET /transactions", () => {
    async function seedRate(
      rateDate: string,
      quote: string,
      rate: string,
    ): Promise<void> {
      await dataSource.getRepository(FxRate).insert({
        rateDate,
        baseCurrency: "EUR",
        quoteCurrency: quote,
        rate,
        fetchedAt: new Date(),
      });
    }

    it("includes a base-currency rollup using a same-day rate", async () => {
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
      await seedRate("2026-06-07", "USD", "1.080000");

      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "100.00",
          currency: "EUR",
          description: "Travel",
          kind: "expense",
        })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get("/transactions")
        .set("Cookie", cookie)
        .expect(200);
      const item = list.body.items[0];
      expect(item.baseCurrency).toBe("USD");
      expect(item.baseAmount).toBe("108.00");
      expect(item.rateSubstituted).toBe(false);
      expect(item.rateDate).toBe("2026-06-07");
      expect(item.unconvertible).toBe(false);
    });

    it("treats yesterday's close as today's rate without flagging substituted", async () => {
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
      await seedRate("2026-06-06", "USD", "1.082000");

      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "100.00",
          currency: "EUR",
          description: "Hotel",
          kind: "expense",
        })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get("/transactions")
        .set("Cookie", cookie)
        .expect(200);
      expect(list.body.items[0].rateSubstituted).toBe(false);
      expect(list.body.items[0].rateDate).toBe("2026-06-06");
      expect(list.body.items[0].baseAmount).toBe("108.20");
    });

    it("flags substituted when the rate is genuinely stale (gap > 5 days)", async () => {
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
      await seedRate("2026-05-30", "USD", "1.082000");

      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "100.00",
          currency: "EUR",
          description: "Hotel",
          kind: "expense",
        })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get("/transactions")
        .set("Cookie", cookie)
        .expect(200);
      expect(list.body.items[0].rateSubstituted).toBe(true);
      expect(list.body.items[0].rateDate).toBe("2026-05-30");
    });

    it("rejects POST /transactions when the currency is outside the supported set", async () => {
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
          amount: "9000.00",
          currency: "XYZ",
          description: "Mystery",
          kind: "expense",
        })
        .expect(400);
    });

    it("GET /transactions/:id returns the converted shape", async () => {
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
      await seedRate("2026-06-07", "BRL", "5.400000");

      const created = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "54.00",
          currency: "BRL",
          description: "Snack",
          kind: "expense",
        })
        .expect(201);

      const id = created.body.transactions[0].id;
      const res = await request(app.getHttpServer())
        .get(`/transactions/${id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(res.body.transaction.id).toBe(id);
      expect(res.body.transaction.baseCurrency).toBe("EUR");
      expect(res.body.transaction.baseAmount).toBe("10.00");
      expect(res.body.transaction.rateSubstituted).toBe(false);
    });

    it("GET /transactions/:id returns 404 for another user's row", async () => {
      const { cookie: aliceC } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });
      const created = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", aliceC)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "Coffee",
          kind: "expense",
        })
        .expect(201);
      await request(app.getHttpServer())
        .get(`/transactions/${created.body.transactions[0].id}`)
        .set("Cookie", bobC)
        .expect(404);
    });
  });

  describe("POST /internal/fx/fetch trigger", () => {
    it("runs the catch-up on first call and no-ops on the next", async () => {
      fxClientStub.fetchHistoricalEurAnchored.mockResolvedValue([
        { rateDate: "2026-06-07", rates: { USD: "1.083000" } },
      ]);

      const first = await request(app.getHttpServer())
        .post("/internal/fx/fetch")
        .expect(200);
      expect(first.body.from).toBe("2026-01-01");
      expect(first.body.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(first.body.noop).toBe(false);

      const second = await request(app.getHttpServer())
        .post("/internal/fx/fetch")
        .expect(200);
      expect(second.body.noop).toBe(true);
      expect(second.body.persisted).toBe(0);
      expect(fxClientStub.fetchHistoricalEurAnchored).toHaveBeenCalledTimes(1);
    });
  });

  describe("FxScheduledJob catch-up", () => {
    it("seeds rates over the coverage window and is idempotent across firings", async () => {
      fxClientStub.fetchHistoricalEurAnchored.mockResolvedValue([
        { rateDate: "2026-06-07", rates: { USD: "1.083000", BRL: "5.420000" } },
      ]);

      const job = app.get(FxScheduledJob);
      await job.runOnce();
      await job.runOnce();

      const rows = await dataSource.getRepository(FxRate).find();
      const codes = rows.map((r) => r.quoteCurrency).sort();
      expect(codes).toEqual(["BRL", "USD"]);
      // Second firing finds the watermark at today and never re-queries upstream.
      expect(fxClientStub.fetchHistoricalEurAnchored).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /summary", () => {
    async function seedRate(
      rateDate: string,
      quote: string,
      rate: string,
    ): Promise<void> {
      await dataSource.getRepository(FxRate).insert({
        rateDate,
        baseCurrency: "EUR",
        quoteCurrency: quote,
        rate,
        fetchedAt: new Date(),
      });
    }

    async function aliceCookie(): Promise<string> {
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
      return cookie;
    }

    async function capture(
      cookie: string,
      overrides: Partial<{
        date: string;
        amount: string;
        currency: string;
        description: string;
        kind: "income" | "expense";
        tagNames: string[];
      }> = {},
    ): Promise<{ id: string }> {
      const body = {
        date: "2026-06-07",
        amount: "10.00",
        currency: "USD",
        description: "row",
        kind: "expense" as const,
        ...overrides,
      };
      const res = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send(body)
        .expect(201);
      return { id: res.body.transactions[0].id as string };
    }

    async function tagId(cookie: string, name: string): Promise<string> {
      const list = await request(app.getHttpServer())
        .get("/tags")
        .set("Cookie", cookie)
        .expect(200);
      const found = list.body.items.find(
        (t: { name: string }) => t.name === name,
      );
      return found.id as string;
    }

    it("returns income, expense, net, and byTag in base currency for the chosen month", async () => {
      const cookie = await aliceCookie();

      await capture(cookie, {
        date: "2026-06-03",
        amount: "30.00",
        kind: "expense",
        tagNames: ["Food"],
        description: "groceries",
      });
      await capture(cookie, {
        date: "2026-06-20",
        amount: "20.00",
        kind: "expense",
        tagNames: ["Food"],
        description: "lunch",
      });
      await capture(cookie, {
        date: "2026-06-15",
        amount: "15.00",
        kind: "expense",
        tagNames: ["Transport"],
        description: "bus",
      });
      await capture(cookie, {
        date: "2026-06-30",
        amount: "1000.00",
        kind: "income",
        description: "salary",
      });
      await capture(cookie, {
        date: "2026-05-15",
        amount: "999.00",
        kind: "expense",
        description: "out-of-window",
      });

      const foodTagId = await tagId(cookie, "Food");
      const transportTagId = await tagId(cookie, "Transport");

      const res = await request(app.getHttpServer())
        .get("/summary?month=2026-06")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toEqual({
        month: "2026-06",
        baseCurrency: "USD",
        income: "1000.00",
        expense: "65.00",
        net: "935.00",
        byTag: [
          {
            tagId: foodTagId,
            tagName: "Food",
            color: assignColor("Food"),
            income: "0.00",
            expense: "50.00",
            net: "-50.00",
          },
          {
            tagId: transportTagId,
            tagName: "Transport",
            color: assignColor("Transport"),
            income: "0.00",
            expense: "15.00",
            net: "-15.00",
          },
          {
            tagId: null,
            tagName: null,
            color: null,
            income: "1000.00",
            expense: "0.00",
            net: "1000.00",
          },
        ],
        excludedUnconvertibleCount: 0,
      });
      expect(res.body).not.toHaveProperty("byCategory");
    });

    describe("byTag rollup", () => {
      it("multi-counts a two-tag expense so bucket sums exceed totals", async () => {
        const cookie = await aliceCookie();
        await capture(cookie, {
          date: "2026-06-07",
          amount: "100.00",
          kind: "expense",
          tagNames: ["A", "B"],
          description: "two-tag",
        });

        const res = await request(app.getHttpServer())
          .get("/summary?month=2026-06")
          .set("Cookie", cookie)
          .expect(200);

        const bucketA = res.body.byTag.find(
          (b: { tagName: string | null }) => b.tagName === "A",
        );
        const bucketB = res.body.byTag.find(
          (b: { tagName: string | null }) => b.tagName === "B",
        );
        expect(bucketA.expense).toBe("100.00");
        expect(bucketB.expense).toBe("100.00");
        expect(res.body.expense).toBe("100.00");
        expect(
          Number(bucketA.expense) + Number(bucketB.expense),
        ).toBeGreaterThan(Number(res.body.expense));
      });

      it("multi-counts a two-tag income bucket", async () => {
        const cookie = await aliceCookie();
        await capture(cookie, {
          date: "2026-06-07",
          amount: "100.00",
          kind: "income",
          tagNames: ["A", "B"],
          description: "two-tag-income",
        });

        const res = await request(app.getHttpServer())
          .get("/summary?month=2026-06")
          .set("Cookie", cookie)
          .expect(200);

        const bucketA = res.body.byTag.find(
          (b: { tagName: string | null }) => b.tagName === "A",
        );
        const bucketB = res.body.byTag.find(
          (b: { tagName: string | null }) => b.tagName === "B",
        );
        expect(bucketA.income).toBe("100.00");
        expect(bucketB.income).toBe("100.00");
        expect(res.body.income).toBe("100.00");
      });

      it("routes a tagless row into a single null-tag bucket", async () => {
        const cookie = await aliceCookie();
        await capture(cookie, {
          date: "2026-06-07",
          amount: "100.00",
          kind: "expense",
          description: "untagged",
        });

        const res = await request(app.getHttpServer())
          .get("/summary?month=2026-06")
          .set("Cookie", cookie)
          .expect(200);

        expect(res.body.byTag).toEqual([
          {
            tagId: null,
            tagName: null,
            color: null,
            income: "0.00",
            expense: "100.00",
            net: "-100.00",
          },
        ]);
      });

      it("exposes each non-null tagId bucket's color and null for the Untagged bucket", async () => {
        const cookie = await aliceCookie();
        await capture(cookie, {
          date: "2026-06-07",
          amount: "10.00",
          kind: "expense",
          tagNames: ["A"],
          description: "tagged",
        });
        await capture(cookie, {
          date: "2026-06-08",
          amount: "5.00",
          kind: "expense",
          description: "untagged",
        });

        const res = await request(app.getHttpServer())
          .get("/summary?month=2026-06")
          .set("Cookie", cookie)
          .expect(200);

        const tagged = res.body.byTag.find(
          (b: { tagId: string | null }) => b.tagId !== null,
        );
        const untagged = res.body.byTag.find(
          (b: { tagId: string | null }) => b.tagId === null,
        );
        expect(tagged.color).toBe(assignColor("A"));
        expect(untagged.color).toBeNull();
      });

      it("carries byTag and never byCategory", async () => {
        const cookie = await aliceCookie();
        const res = await request(app.getHttpServer())
          .get("/summary?month=2026-06")
          .set("Cookie", cookie)
          .expect(200);
        expect(res.body).toHaveProperty("byTag");
        expect(res.body).not.toHaveProperty("byCategory");
      });
    });

    it("converts foreign-currency rows at the transaction date's rate", async () => {
      const cookie = await aliceCookie();
      await seedRate("2026-06-07", "USD", "1.080000");
      await seedRate("2026-06-10", "USD", "1.100000");
      await capture(cookie, {
        date: "2026-06-07",
        amount: "100.00",
        currency: "EUR",
        description: "Hotel night 1",
        kind: "expense",
      });
      await capture(cookie, {
        date: "2026-06-10",
        amount: "200.00",
        currency: "EUR",
        description: "Hotel night 2",
        kind: "expense",
      });

      const res = await request(app.getHttpServer())
        .get("/summary?month=2026-06")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.expense).toBe("328.00");
      expect(res.body.income).toBe("0.00");
      expect(res.body.net).toBe("-328.00");
    });

    it("excludes unconvertible rows from totals and reports the count", async () => {
      const cookie = await aliceCookie();
      // No EUR<->BRL leg seeded → BRL row is unconvertible against USD base.
      await capture(cookie, {
        date: "2026-06-07",
        amount: "100.00",
        currency: "USD",
        description: "USD row",
        kind: "expense",
      });
      await capture(cookie, {
        date: "2026-06-09",
        amount: "500.00",
        currency: "BRL",
        description: "BRL row",
        kind: "expense",
      });

      const res = await request(app.getHttpServer())
        .get("/summary?month=2026-06")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.expense).toBe("100.00");
      expect(res.body.excludedUnconvertibleCount).toBe(1);
    });

    it("rejects an invalid month with 400", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .get("/summary?month=2026-13")
        .set("Cookie", cookie)
        .expect(400);
      await request(app.getHttpServer())
        .get("/summary?month=June")
        .set("Cookie", cookie)
        .expect(400);
      await request(app.getHttpServer())
        .get("/summary")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("never leaks another user's transactions", async () => {
      const aliceC = await aliceCookie();
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });
      await request(app.getHttpServer())
        .put("/users/me/base-currency")
        .set("Cookie", bobC)
        .send({ baseCurrency: "USD" })
        .expect(200);
      await capture(aliceC, { description: "alice-row", amount: "10.00" });
      await capture(bobC, { description: "bob-row", amount: "20.00" });

      const aliceRes = await request(app.getHttpServer())
        .get("/summary?month=2026-06")
        .set("Cookie", aliceC)
        .expect(200);
      const bobRes = await request(app.getHttpServer())
        .get("/summary?month=2026-06")
        .set("Cookie", bobC)
        .expect(200);

      expect(aliceRes.body.expense).toBe("10.00");
      expect(bobRes.body.expense).toBe("20.00");
    });
  });

  describe("GET /trend", () => {
    async function aliceCookie(): Promise<string> {
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
      return cookie;
    }

    async function capture(
      cookie: string,
      date: string,
      amount: string,
      kind: "income" | "expense",
    ): Promise<void> {
      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date,
          amount,
          currency: "USD",
          description: `row-${date}-${kind}`,
          kind,
        })
        .expect(201);
    }

    it("returns one point per month in the window, zero-filling empty months", async () => {
      const cookie = await aliceCookie();
      await capture(cookie, "2026-04-15", "100.00", "expense");
      await capture(cookie, "2026-06-01", "200.00", "income");
      await capture(cookie, "2026-06-30", "50.00", "expense");

      const res = await request(app.getHttpServer())
        .get("/trend?from=2026-04&to=2026-06")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body).toEqual({
        from: "2026-04",
        to: "2026-06",
        baseCurrency: "USD",
        points: [
          {
            month: "2026-04",
            income: "0.00",
            expense: "100.00",
            net: "-100.00",
          },
          { month: "2026-05", income: "0.00", expense: "0.00", net: "0.00" },
          {
            month: "2026-06",
            income: "200.00",
            expense: "50.00",
            net: "150.00",
          },
        ],
        excludedUnconvertibleCount: 0,
      });
    });

    it("defaults the from bound to the user's earliest transaction month", async () => {
      const cookie = await aliceCookie();
      await capture(cookie, "2026-04-15", "100.00", "expense");

      const res = await request(app.getHttpServer())
        .get("/trend")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.from).toBe("2026-04");
      expect(res.body.to).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      expect(res.body.points[0]).toMatchObject({
        month: "2026-04",
        expense: "100.00",
      });
    });

    it("returns a single current-month point when the user has no transactions", async () => {
      const cookie = await aliceCookie();
      const res = await request(app.getHttpServer())
        .get("/trend")
        .set("Cookie", cookie)
        .expect(200);
      expect(res.body.points).toHaveLength(1);
      expect(res.body.from).toBe(res.body.to);
      expect(res.body.points[0]).toMatchObject({
        income: "0.00",
        expense: "0.00",
        net: "0.00",
      });
    });

    it("counts unconvertible rows separately and excludes them from points", async () => {
      const cookie = await aliceCookie();
      await capture(cookie, "2026-06-07", "100.00", "expense");
      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-09",
          amount: "500.00",
          currency: "BRL",
          description: "unconvertible",
          kind: "expense",
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get("/trend?from=2026-06&to=2026-06")
        .set("Cookie", cookie)
        .expect(200);
      expect(res.body.points).toEqual([
        { month: "2026-06", income: "0.00", expense: "100.00", net: "-100.00" },
      ]);
      expect(res.body.excludedUnconvertibleCount).toBe(1);
    });

    it("rejects an invalid bound with 400", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .get("/trend?from=2026-13")
        .set("Cookie", cookie)
        .expect(400);
      await request(app.getHttpServer())
        .get("/trend?to=2026-aa")
        .set("Cookie", cookie)
        .expect(400);
    });
  });

  describe("GET /tags/:id/drill-down", () => {
    async function aliceCookie(): Promise<string> {
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
      return cookie;
    }

    async function capture(
      cookie: string,
      overrides: Partial<{
        date: string;
        amount: string;
        currency: string;
        description: string;
        kind: "income" | "expense";
        tagNames: string[];
      }> = {},
    ): Promise<{ id: string }> {
      const body = {
        date: "2026-06-07",
        amount: "10.00",
        currency: "USD",
        description: "row",
        kind: "expense" as const,
        ...overrides,
      };
      const res = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send(body)
        .expect(201);
      return { id: res.body.transactions[0].id as string };
    }

    async function createTag(cookie: string, name: string): Promise<string> {
      const res = await request(app.getHttpServer())
        .post("/tags")
        .set("Cookie", cookie)
        .send({ name })
        .expect(201);
      return res.body.tag.id as string;
    }

    it("returns linked transactions plus a by-month breakdown and no dimensional inner rollup", async () => {
      const cookie = await aliceCookie();
      const travelTagId = await createTag(cookie, "travel");

      await capture(cookie, {
        date: "2026-05-15",
        amount: "100.00",
        description: "Linked-1",
        tagNames: ["travel"],
      });
      await capture(cookie, {
        date: "2026-06-10",
        amount: "50.00",
        description: "Linked-2",
        tagNames: ["travel"],
      });
      await capture(cookie, {
        date: "2026-06-15",
        amount: "9999.00",
        description: "Untagged",
      });

      const res = await request(app.getHttpServer())
        .get(`/tags/${travelTagId}/drill-down`)
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.tag).toEqual({
        id: travelTagId,
        name: "travel",
        color: assignColor("travel"),
      });
      expect(res.body.baseCurrency).toBe("USD");
      expect(res.body.transactions).toHaveLength(2);
      expect(
        res.body.transactions.map(
          (t: { description: string }) => t.description,
        ),
      ).toEqual(["Linked-2", "Linked-1"]);
      expect(res.body).not.toHaveProperty("byCategory");
      expect(res.body).not.toHaveProperty("byTag");
      expect(res.body.byMonth).toEqual([
        { month: "2026-05", income: "0.00", expense: "100.00", net: "-100.00" },
        { month: "2026-06", income: "0.00", expense: "50.00", net: "-50.00" },
      ]);
      expect(res.body.excludedUnconvertibleCount).toBe(0);
    });

    it("respects the optional from/to month window", async () => {
      const cookie = await aliceCookie();
      const travelTagId = await createTag(cookie, "travel");
      await capture(cookie, {
        date: "2026-05-15",
        amount: "100.00",
        description: "May",
        tagNames: ["travel"],
      });
      await capture(cookie, {
        date: "2026-06-15",
        amount: "200.00",
        description: "June",
        tagNames: ["travel"],
      });

      const res = await request(app.getHttpServer())
        .get(`/tags/${travelTagId}/drill-down?from=2026-06&to=2026-06`)
        .set("Cookie", cookie)
        .expect(200);
      expect(res.body.transactions).toHaveLength(1);
      expect(res.body.transactions[0].description).toBe("June");
      expect(res.body.byMonth).toEqual([
        { month: "2026-06", income: "0.00", expense: "200.00", net: "-200.00" },
      ]);
    });

    it("counts unconvertible rows separately", async () => {
      const cookie = await aliceCookie();
      const travelTagId = await createTag(cookie, "travel");
      await capture(cookie, {
        date: "2026-06-07",
        amount: "100.00",
        currency: "USD",
        description: "USD row",
        tagNames: ["travel"],
      });
      await capture(cookie, {
        date: "2026-06-09",
        amount: "500.00",
        currency: "BRL",
        description: "BRL row",
        tagNames: ["travel"],
      });

      const res = await request(app.getHttpServer())
        .get(`/tags/${travelTagId}/drill-down`)
        .set("Cookie", cookie)
        .expect(200);
      expect(res.body.transactions).toHaveLength(2);
      expect(res.body.byMonth).toEqual([
        { month: "2026-06", income: "0.00", expense: "100.00", net: "-100.00" },
      ]);
      expect(res.body.excludedUnconvertibleCount).toBe(1);
    });

    it("returns 404 when the tag does not exist or belongs to another user", async () => {
      const aliceC = await aliceCookie();
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });
      const bobTagId = await createTag(bobC, "bob-tag");

      await request(app.getHttpServer())
        .get(`/tags/${bobTagId}/drill-down`)
        .set("Cookie", aliceC)
        .expect(404);

      await request(app.getHttpServer())
        .get("/tags/00000000-0000-0000-0000-000000000000/drill-down")
        .set("Cookie", aliceC)
        .expect(404);
    });
  });

  describe("GET /transactions filter set", () => {
    async function aliceCookie(): Promise<string> {
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
      return cookie;
    }

    async function capture(
      cookie: string,
      overrides: Partial<{
        date: string;
        amount: string;
        description: string;
        kind: "income" | "expense";
        tagNames: string[];
      }> = {},
    ): Promise<{ id: string }> {
      const body = {
        date: "2026-06-07",
        amount: "10.00",
        currency: "USD",
        description: "row",
        kind: "expense" as const,
        ...overrides,
      };
      const res = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send(body)
        .expect(201);
      return { id: res.body.transactions[0].id as string };
    }

    it("filters by from/to date range, inclusive", async () => {
      const cookie = await aliceCookie();
      await capture(cookie, { date: "2026-04-30", description: "Apr-30" });
      await capture(cookie, { date: "2026-05-01", description: "May-01" });
      await capture(cookie, { date: "2026-05-31", description: "May-31" });
      await capture(cookie, { date: "2026-06-01", description: "Jun-01" });

      const res = await request(app.getHttpServer())
        .get("/transactions?from=2026-05-01&to=2026-05-31")
        .set("Cookie", cookie)
        .expect(200);
      expect(
        res.body.items.map((t: { description: string }) => t.description),
      ).toEqual(["May-31", "May-01"]);
    });

    it("filters by tagId via the join table", async () => {
      const cookie = await aliceCookie();
      await capture(cookie, { description: "tagged", tagNames: ["travel"] });
      await capture(cookie, { description: "untagged" });
      const tagsList = await request(app.getHttpServer())
        .get("/tags")
        .set("Cookie", cookie)
        .expect(200);
      const tagId = tagsList.body.items.find(
        (t: { name: string }) => t.name === "travel",
      ).id;

      const res = await request(app.getHttpServer())
        .get(`/transactions?tagId=${tagId}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(
        res.body.items.map((t: { description: string }) => t.description),
      ).toEqual(["tagged"]);
    });

    it("filters by kind", async () => {
      const cookie = await aliceCookie();
      await capture(cookie, { description: "salary", kind: "income" });
      await capture(cookie, { description: "lunch", kind: "expense" });

      const res = await request(app.getHttpServer())
        .get("/transactions?kind=income")
        .set("Cookie", cookie)
        .expect(200);
      expect(
        res.body.items.map((t: { description: string }) => t.description),
      ).toEqual(["salary"]);
    });

    it("filters by free-text q with case-insensitive ILIKE", async () => {
      const cookie = await aliceCookie();
      await capture(cookie, { description: "Coffee on Friday" });
      await capture(cookie, { description: "Tea" });
      await capture(cookie, { description: "Espresso" });

      const res = await request(app.getHttpServer())
        .get("/transactions?q=coffee")
        .set("Cookie", cookie)
        .expect(200);
      expect(
        res.body.items.map((t: { description: string }) => t.description),
      ).toEqual(["Coffee on Friday"]);
    });

    it("combines filters and still paginates by keyset", async () => {
      const cookie = await aliceCookie();
      for (let day = 1; day <= 6; day += 1) {
        await capture(cookie, {
          date: `2026-06-0${day}`,
          description: `expense-${day}`,
          kind: "expense",
        });
      }
      await capture(cookie, {
        description: "income-row",
        date: "2026-06-07",
        kind: "income",
      });

      const first = await request(app.getHttpServer())
        .get("/transactions?kind=expense&limit=4")
        .set("Cookie", cookie)
        .expect(200);
      expect(first.body.items).toHaveLength(4);
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await request(app.getHttpServer())
        .get(
          `/transactions?kind=expense&limit=4&cursor=${first.body.nextCursor}`,
        )
        .set("Cookie", cookie)
        .expect(200);
      expect(second.body.items).toHaveLength(2);
      expect(second.body.nextCursor).toBeNull();
    });

    it("rejects an invalid filter shape with 400", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .get("/transactions?from=06/01/2026")
        .set("Cookie", cookie)
        .expect(400);
      await request(app.getHttpServer())
        .get("/transactions?kind=transfer")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("rejects an unknown categoryId query parameter with 400", async () => {
      const cookie = await aliceCookie();
      const res = await request(app.getHttpServer())
        .get("/transactions?categoryId=11111111-1111-4111-8111-111111111111")
        .set("Cookie", cookie)
        .expect(400);
      expect(JSON.stringify(res.body)).toMatch(/categoryId/);
    });
  });

  describe("POST /transactions installments", () => {
    async function aliceCookie(): Promise<string> {
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
      return cookie;
    }

    it("collapses installments.count = 1 to a single standalone row", async () => {
      const cookie = await aliceCookie();
      const res = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
          installments: { count: 1 },
        })
        .expect(201);
      expect(res.body.transactions).toHaveLength(1);
      expect(res.body.transactions[0].group).toBeNull();
    });

    it("creates N rows one calendar month apart sharing a group id and exposes position/size", async () => {
      const cookie = await aliceCookie();
      const res = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-01-31",
          amount: "100.00",
          currency: "USD",
          description: "Phone",
          kind: "expense",
          installments: { count: 4 },
        })
        .expect(201);

      expect(res.body.transactions).toHaveLength(4);
      const dates = res.body.transactions.map((t: { date: string }) => t.date);
      expect(dates).toEqual([
        "2026-01-31",
        "2026-02-28",
        "2026-03-31",
        "2026-04-30",
      ]);
      const groupIds = new Set(
        res.body.transactions.map((t: { group: { id: string } }) => t.group.id),
      );
      expect(groupIds.size).toBe(1);
      for (const [i, t] of res.body.transactions.entries()) {
        expect(t.group.position).toBe(i + 1);
        expect(t.group.size).toBe(4);
      }
    });

    it("rejects an installments hint with count > 360 with 400", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-01-31",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
          installments: { count: 999 },
        })
        .expect(400);
    });

    it("re-derives position and size after a middle-row delete", async () => {
      const cookie = await aliceCookie();
      const res = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
          installments: { count: 5 },
        })
        .expect(201);

      const middle = res.body.transactions[2];
      await request(app.getHttpServer())
        .delete(`/transactions/${middle.id}`)
        .set("Cookie", cookie)
        .expect(204);

      const list = await request(app.getHttpServer())
        .get(`/transactions?groupId=${middle.group.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(list.body.items).toHaveLength(4);
      const sizes = new Set(
        list.body.items.map((t: { group: { size: number } }) => t.group.size),
      );
      expect(sizes).toEqual(new Set([4]));
      const positions = list.body.items
        .map((t: { group: { position: number } }) => t.group.position)
        .sort();
      expect(positions).toEqual([1, 2, 3, 4]);
    });

    it("filters transactions by groupId", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "5.00",
          currency: "USD",
          description: "standalone",
          kind: "expense",
        })
        .expect(201);
      const grouped = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "grouped",
          kind: "expense",
          installments: { count: 3 },
        })
        .expect(201);
      const groupId = grouped.body.transactions[0].group.id;

      const filtered = await request(app.getHttpServer())
        .get(`/transactions?groupId=${groupId}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(filtered.body.items).toHaveLength(3);
      for (const item of filtered.body.items) {
        expect(item.group.id).toBe(groupId);
      }
    });
  });

  describe("erasure: deleting a user removes their cashflow rows", () => {
    it("cascades transactions, installment groups, tags, joins, and user_settings on user delete", async () => {
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
          tagNames: ["travel"],
        })
        .expect(201);
      const installment = await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-01-31",
          amount: "100.00",
          currency: "USD",
          description: "Phone",
          kind: "expense",
          tagNames: ["electronics"],
          installments: { count: 3 },
        })
        .expect(201);
      expect(installment.body.transactions).toHaveLength(3);

      await request(app.getHttpServer())
        .delete("/users/me")
        .set("Cookie", cookie)
        .send({ confirm: true })
        .expect(204);

      expect(await dataSource.getRepository(Transaction).count()).toBe(0);
      expect(await dataSource.getRepository(TransactionTag).count()).toBe(0);
      expect(await dataSource.getRepository(Tag).count()).toBe(0);
      const settingsCount = await dataSource.query(
        'SELECT COUNT(*)::int AS c FROM "user_settings"',
      );
      expect(settingsCount[0].c).toBe(0);
      const groupCount = await dataSource.query(
        'SELECT COUNT(*)::int AS c FROM "transactions" WHERE "group_id" IS NOT NULL',
      );
      expect(groupCount[0].c).toBe(0);
    });
  });
});
