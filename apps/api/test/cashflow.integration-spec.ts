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
import { Category } from "@/cashflow/entities/category.entity";
import { Tag } from "@/cashflow/entities/tag.entity";
import { Transaction } from "@/cashflow/entities/transaction.entity";
import { TransactionTag } from "@/cashflow/entities/transaction-tag.entity";
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
      'TRUNCATE TABLE "transaction_tags", "tags", "categories", "transactions", "user_settings", "sign_in_events", "sessions", "device_fingerprints", "identities", "users", "fx_rates", "fx_coverage" RESTART IDENTITY CASCADE',
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

      expect(res.body.transaction).toEqual({
        id: expect.any(String),
        date: "2026-06-07",
        amount: "12.34",
        currency: "USD",
        description: "Lunch",
        kind: "expense",
        categoryId: null,
        tagIds: [],
        baseAmount: "12.34",
        baseCurrency: "USD",
        rateSubstituted: false,
        rateDate: "2026-06-07",
        unconvertible: false,
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

  describe("/categories CRUD", () => {
    async function aliceCookie(): Promise<string> {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });
      return cookie;
    }

    it("creates, lists, renames, and deletes user-scoped categories", async () => {
      const cookie = await aliceCookie();

      const created = await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Groceries" })
        .expect(201);
      const id = created.body.category.id as string;
      expect(created.body.category).toEqual({ id, name: "Groceries" });

      await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Transport" })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get("/categories")
        .set("Cookie", cookie)
        .expect(200);
      expect(list.body.items.map((c: { name: string }) => c.name)).toEqual([
        "Groceries",
        "Transport",
      ]);

      const renamed = await request(app.getHttpServer())
        .patch(`/categories/${id}`)
        .set("Cookie", cookie)
        .send({ name: "Food" })
        .expect(200);
      expect(renamed.body.category.name).toBe("Food");

      await request(app.getHttpServer())
        .delete(`/categories/${id}`)
        .set("Cookie", cookie)
        .expect(204);

      const after = await request(app.getHttpServer())
        .get("/categories")
        .set("Cookie", cookie)
        .expect(200);
      expect(after.body.items).toHaveLength(1);
    });

    it("rejects a duplicate name on create with 409", async () => {
      const cookie = await aliceCookie();
      await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Groceries" })
        .expect(201);
      await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Groceries" })
        .expect(409);
    });

    it("rejects a rename that collides with another category for the same user", async () => {
      const cookie = await aliceCookie();
      const first = await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Groceries" })
        .expect(201);
      await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Transport" })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/categories/${first.body.category.id}`)
        .set("Cookie", cookie)
        .send({ name: "Transport" })
        .expect(409);
    });

    it("sets category_id to NULL on linked transactions when the category is deleted", async () => {
      const cookie = await aliceCookie();
      const cat = await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Groceries" })
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
          categoryId: cat.body.category.id,
        })
        .expect(201);
      expect(tx.body.transaction.categoryId).toBe(cat.body.category.id);

      await request(app.getHttpServer())
        .delete(`/categories/${cat.body.category.id}`)
        .set("Cookie", cookie)
        .expect(204);

      const reread = await request(app.getHttpServer())
        .get("/transactions")
        .set("Cookie", cookie)
        .expect(200);
      expect(reread.body.items[0].categoryId).toBeNull();
      const txCount = await dataSource.getRepository(Transaction).count();
      expect(txCount).toBe(1);
    });

    it("never leaks another user's categories through the list endpoint", async () => {
      const aliceC = await aliceCookie();
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });

      await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", aliceC)
        .send({ name: "Alice-cat" })
        .expect(201);
      const bobCat = await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", bobC)
        .send({ name: "Bob-cat" })
        .expect(201);

      const aliceList = await request(app.getHttpServer())
        .get("/categories")
        .set("Cookie", aliceC)
        .expect(200);
      expect(
        aliceList.body.items.some(
          (c: { name: string }) => c.name === "Bob-cat",
        ),
      ).toBe(false);

      await request(app.getHttpServer())
        .patch(`/categories/${bobCat.body.category.id}`)
        .set("Cookie", aliceC)
        .send({ name: "hijacked" })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/categories/${bobCat.body.category.id}`)
        .set("Cookie", aliceC)
        .expect(404);
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

      const renamed = await request(app.getHttpServer())
        .patch(`/tags/${id}`)
        .set("Cookie", cookie)
        .send({ name: "vacation" })
        .expect(200);
      expect(renamed.body.tag.name).toBe("vacation");

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
      expect(tx.body.transaction.tagIds).toHaveLength(2);

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

  describe("POST /transactions with categories and tags", () => {
    async function aliceCookie(): Promise<string> {
      const { cookie } = await signInUser({
        sub: "sub-a",
        name: "Alice",
        email: "alice@example.com",
      });
      return cookie;
    }

    it("attaches an existing categoryId and resolves a mix of existing and new tag names in one DB transaction", async () => {
      const cookie = await aliceCookie();
      const cat = await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Food" })
        .expect(201);
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
          categoryId: cat.body.category.id,
          tagNames: ["travel", "lisbon"],
        })
        .expect(201);
      expect(tx.body.transaction.categoryId).toBe(cat.body.category.id);
      expect(tx.body.transaction.tagIds).toHaveLength(2);

      const tags = await dataSource.getRepository(Tag).find({
        order: { name: "ASC" },
      });
      expect(tags.map((t) => t.name)).toEqual(["lisbon", "travel"]);
    });

    it("rejects a categoryId that does not belong to the user with 400", async () => {
      const aliceC = await aliceCookie();
      const { cookie: bobC } = await signInUser({
        sub: "sub-b",
        name: "Bob",
        email: "bob@example.com",
      });
      const bobCat = await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", bobC)
        .send({ name: "Bob" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", aliceC)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "row",
          kind: "expense",
          categoryId: bobCat.body.category.id,
        })
        .expect(400);
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
        .patch(`/transactions/${tx.body.transaction.id}`)
        .set("Cookie", cookie)
        .send({ tagNames: ["lisbon", "food"] })
        .expect(200);
      expect(patched.body.transaction.tagIds).toHaveLength(2);

      const tagsForTx = await dataSource
        .getRepository(TransactionTag)
        .count({ where: { transactionId: tx.body.transaction.id } });
      expect(tagsForTx).toBe(2);

      const allTags = await dataSource.getRepository(Tag).find();
      expect(allTags.map((t) => t.name).sort()).toEqual([
        "food",
        "lisbon",
        "travel",
      ]);
    });

    it("clears the category when categoryId is null and changes the kind", async () => {
      const cookie = await aliceCookie();
      const cat = await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Food" })
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
          categoryId: cat.body.category.id,
        })
        .expect(201);

      const patched = await request(app.getHttpServer())
        .patch(`/transactions/${tx.body.transaction.id}`)
        .set("Cookie", cookie)
        .send({ categoryId: null, kind: "income", amount: "20.00" })
        .expect(200);
      expect(patched.body.transaction.categoryId).toBeNull();
      expect(patched.body.transaction.kind).toBe("income");
      expect(patched.body.transaction.amount).toBe("20.00");
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
        .patch(`/transactions/${tx.body.transaction.id}`)
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
        .delete(`/transactions/${tx.body.transaction.id}`)
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
        .delete(`/transactions/${tx.body.transaction.id}`)
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

      const id = created.body.transaction.id;
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
        .get(`/transactions/${created.body.transaction.id}`)
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

  describe("erasure: deleting a user removes their cashflow rows", () => {
    it("cascades transactions, categories, tags, joins, and user_settings on user delete", async () => {
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
      const cat = await request(app.getHttpServer())
        .post("/categories")
        .set("Cookie", cookie)
        .send({ name: "Food" })
        .expect(201);
      await request(app.getHttpServer())
        .post("/transactions")
        .set("Cookie", cookie)
        .send({
          date: "2026-06-07",
          amount: "10.00",
          currency: "USD",
          description: "Lunch",
          kind: "expense",
          categoryId: cat.body.category.id,
          tagNames: ["travel"],
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete("/users/me")
        .set("Cookie", cookie)
        .send({ confirm: true })
        .expect(204);

      expect(await dataSource.getRepository(Transaction).count()).toBe(0);
      expect(await dataSource.getRepository(TransactionTag).count()).toBe(0);
      expect(await dataSource.getRepository(Category).count()).toBe(0);
      expect(await dataSource.getRepository(Tag).count()).toBe(0);
      const settingsCount = await dataSource.query(
        'SELECT COUNT(*)::int AS c FROM "user_settings"',
      );
      expect(settingsCount[0].c).toBe(0);
    });
  });
});
