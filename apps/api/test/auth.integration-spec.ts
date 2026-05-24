import { createHash } from "node:crypto";
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
import { DeviceFingerprint } from "@/auth/entities/device-fingerprint.entity";
import { Identity } from "@/auth/entities/identity.entity";
import { Session } from "@/auth/entities/session.entity";
import { SignInEvent } from "@/auth/entities/sign-in-event.entity";
import { User } from "@/auth/entities/user.entity";
import { computeDeviceFingerprintHash } from "@/auth/fingerprint/device-fingerprint-hash";
import {
  LIMITER_CONFIG,
  type LimiterConfig,
} from "@/auth/rate-limit/limiter.config";
import { SlidingWindowLimiter } from "@/auth/rate-limit/sliding-window-limiter";
import {
  GOOGLE_ID_TOKEN_VERIFIER_OPTIONS,
  type GoogleIdTokenVerifierOptions,
} from "@/auth/services/google-id-token-verifier";
import { SignInEventsRetentionWorker } from "@/auth/services/sign-in-events-retention.worker";

const ISSUER = "https://test-issuer.example.com";
const AUDIENCE = "test-client-id";
const NONCE = "test-nonce";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

describe("Auth integration", () => {
  let container: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer | null;
  let redisAdmin: Redis;
  let app: INestApplication;
  let dataSource: DataSource;
  let limiterConfig: LimiterConfig;
  let signingPrivateKey: CryptoKey;
  let publicJwk: JWK;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine")
      .withDatabase("fortuna_test")
      .withUsername("fortuna")
      .withPassword("fortuna")
      .start();

    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = String(container.getMappedPort(5432));
    process.env.DB_NAME = container.getDatabase();
    process.env.DB_USER = container.getUsername();
    process.env.DB_PASSWORD = container.getPassword();
    process.env.DB_SSL = "false";

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

    // Mutable so individual tests can dial parameters in/out.
    limiterConfig = {
      ip: { windowMs: 60_000, limit: 30 },
      identity: {
        thresholdFailures: 2,
        baseMs: 300,
        capMs: 2_000,
        counterTtlSec: 60,
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_ID_TOKEN_VERIFIER_OPTIONS)
      .useValue(verifierOptions)
      .overrideProvider(LIMITER_CONFIG)
      .useValue(limiterConfig)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await redisAdmin?.quit().catch(() => undefined);
    await redisContainer?.stop();
    await container?.stop();
  });

  beforeEach(async () => {
    if (!dataSource) return;
    await dataSource.query(
      'TRUNCATE TABLE "sign_in_events", "sessions", "device_fingerprints", "identities", "users" RESTART IDENTITY CASCADE',
    );
    if (redisAdmin?.status === "ready" || redisAdmin?.status === "connect") {
      await redisAdmin.flushdb().catch(() => undefined);
    }
    // Reset limiter config to the per-suite default.
    Object.assign(limiterConfig, {
      ip: { windowMs: 60_000, limit: 30 },
      identity: {
        thresholdFailures: 2,
        baseMs: 300,
        capMs: 2_000,
        counterTtlSec: 60,
      },
    } satisfies LimiterConfig);
  });

  async function signIdToken(
    overrides: {
      aud?: string;
      sub?: string;
      name?: string;
      email?: string;
    } = {},
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      nonce: NONCE,
      name: overrides.name ?? "Integration User",
      email: overrides.email ?? "int@example.com",
      picture: "https://example.com/a.png",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer(ISSUER)
      .setAudience(overrides.aud ?? AUDIENCE)
      .setSubject(overrides.sub ?? "google-sub-integration")
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .sign(signingPrivateKey);
  }

  it("creates user + identity + session on first sign-in; stores SHA-256 hash only", async () => {
    const idToken = await signIdToken();

    const res = await request(app.getHttpServer())
      .post("/auth/google")
      .send({ idToken, nonce: NONCE })
      .expect(201);

    expect(res.body.sessionToken).toEqual(expect.any(String));
    expect(res.body.expiresAt).toEqual(expect.any(String));

    const users = await dataSource.getRepository(User).find();
    expect(users).toHaveLength(1);
    const user = users[0];
    if (!user) throw new Error("expected one user");
    expect(user.email).toBe("int@example.com");
    expect(user.name).toBe("Integration User");
    expect(user.avatarUrl).toBe("https://example.com/a.png");

    const identities = await dataSource.getRepository(Identity).find();
    expect(identities).toHaveLength(1);
    const identity = identities[0];
    if (!identity) throw new Error("expected one identity");
    expect(identity.provider).toBe("google");
    expect(identity.providerSubject).toBe("google-sub-integration");
    expect(identity.userId).toBe(user.id);

    const sessions = await dataSource.getRepository(Session).find();
    expect(sessions).toHaveLength(1);
    const session = sessions[0];
    if (!session) throw new Error("expected one session");
    expect(session.tokenHash).toBe(sha256Hex(res.body.sessionToken));
    expect(session.tokenHash).not.toBe(res.body.sessionToken);
  });

  it("converges to a single user when concurrent sign-ins race for the same Google identity", async () => {
    const idTokens = await Promise.all([
      signIdToken({ sub: "race-sub" }),
      signIdToken({ sub: "race-sub" }),
      signIdToken({ sub: "race-sub" }),
    ]);

    const responses = await Promise.all(
      idTokens.map((idToken) =>
        request(app.getHttpServer())
          .post("/auth/google")
          .send({ idToken, nonce: NONCE }),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body.sessionToken).toEqual(expect.any(String));
    }

    expect(await dataSource.getRepository(User).count()).toBe(1);
    expect(await dataSource.getRepository(Identity).count()).toBe(1);
    expect(await dataSource.getRepository(Session).count()).toBe(3);
  });

  it("reuses existing user + identity on returning sign-in and mints a new session", async () => {
    const idToken1 = await signIdToken();
    const res1 = await request(app.getHttpServer())
      .post("/auth/google")
      .send({ idToken: idToken1, nonce: NONCE })
      .expect(201);

    const idToken2 = await signIdToken({ name: "Updated Name" });
    const res2 = await request(app.getHttpServer())
      .post("/auth/google")
      .send({ idToken: idToken2, nonce: NONCE })
      .expect(201);

    expect(res1.body.sessionToken).not.toBe(res2.body.sessionToken);

    const users = await dataSource.getRepository(User).find();
    expect(users).toHaveLength(1);
    expect(users[0]?.name).toBe("Updated Name");

    const identities = await dataSource.getRepository(Identity).find();
    expect(identities).toHaveLength(1);

    const sessions = await dataSource.getRepository(Session).find();
    expect(sessions).toHaveLength(2);
  });

  it("returns 401 with no internal detail on token verification failure", async () => {
    const idToken = await signIdToken({ aud: "wrong-audience" });

    const res = await request(app.getHttpServer())
      .post("/auth/google")
      .send({ idToken, nonce: NONCE })
      .expect(401);

    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("audience");
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("signature");
  });

  it("CASCADE: deleting a user removes its identities and sessions", async () => {
    const idToken = await signIdToken();
    await request(app.getHttpServer())
      .post("/auth/google")
      .send({ idToken, nonce: NONCE })
      .expect(201);

    const userRepo = dataSource.getRepository(User);
    const users = await userRepo.find();
    expect(users).toHaveLength(1);
    const userId = users[0]?.id;
    expect(userId).toBeDefined();

    await userRepo.delete({ id: userId });

    expect(await dataSource.getRepository(User).count()).toBe(0);
    expect(await dataSource.getRepository(Identity).count()).toBe(0);
    expect(await dataSource.getRepository(Session).count()).toBe(0);
  });

  it("GET /users/me with session cookie returns the user profile", async () => {
    const idToken = await signIdToken();
    const signInRes = await request(app.getHttpServer())
      .post("/auth/google")
      .send({ idToken, nonce: NONCE })
      .expect(201);

    const cookie = `fortuna_session=${signInRes.body.sessionToken}`;
    const meRes = await request(app.getHttpServer())
      .get("/users/me")
      .set("Cookie", cookie)
      .expect(200);

    expect(meRes.body).toEqual({
      id: expect.any(String),
      name: "Integration User",
      email: "int@example.com",
      avatarUrl: "https://example.com/a.png",
    });
  });

  it("GET /users/me without session cookie returns 401 with no internal detail", async () => {
    const res = await request(app.getHttpServer()).get("/users/me").expect(401);

    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("revoked");
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("expired");
  });

  describe("session management", () => {
    async function signInAs(
      opts: { sub?: string; email?: string; userAgent?: string } = {},
    ): Promise<{ sessionToken: string; userId: string }> {
      const idToken = await signIdToken({
        sub: opts.sub,
        email: opts.email,
      });
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken, nonce: NONCE })
        .set("User-Agent", opts.userAgent ?? "Mozilla/5.0")
        .expect(201);

      const sessions = await dataSource.getRepository(Session).find();
      const session = sessions.find(
        (s) => s.tokenHash === sha256Hex(res.body.sessionToken),
      );
      if (!session) throw new Error("expected session to be created");

      return { sessionToken: res.body.sessionToken, userId: session.userId };
    }

    it("DELETE /auth/session revokes the session, clears the cookie, and 401s subsequent requests", async () => {
      const { sessionToken } = await signInAs();
      const cookie = `fortuna_session=${sessionToken}`;

      const signOutRes = await request(app.getHttpServer())
        .delete("/auth/session")
        .set("Cookie", cookie)
        .expect(204);

      const setCookieHeader = signOutRes.headers["set-cookie"] as
        | string[]
        | string
        | undefined;
      const setCookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : setCookieHeader
          ? [setCookieHeader]
          : [];
      const clearHeader = setCookies.find((c) =>
        c.startsWith("fortuna_session="),
      );
      expect(clearHeader).toBeDefined();
      expect(clearHeader).toContain("Max-Age=0");
      expect(clearHeader).toContain("Path=/");
      expect(clearHeader?.toLowerCase()).toContain("httponly");

      const sessionRow = await dataSource.getRepository(Session).findOne({
        where: { tokenHash: sha256Hex(sessionToken) },
      });
      expect(sessionRow?.revokedAt).not.toBeNull();

      await request(app.getHttpServer())
        .get("/users/me")
        .set("Cookie", cookie)
        .expect(401);
    });

    it("DELETE /auth/session without a session cookie returns 401", async () => {
      await request(app.getHttpServer()).delete("/auth/session").expect(401);
    });

    it("GET /users/me/sessions returns only the principal's active sessions with isCurrent flag", async () => {
      const first = await signInAs({
        sub: "user-multi",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
      const second = await signInAs({
        sub: "user-multi",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      });
      expect(first.userId).toBe(second.userId);

      const listRes = await request(app.getHttpServer())
        .get("/users/me/sessions")
        .set("Cookie", `fortuna_session=${second.sessionToken}`)
        .expect(200);

      expect(listRes.body).toHaveLength(2);
      const labelled = (
        listRes.body as Array<{
          deviceLabel: string;
          isCurrent: boolean;
        }>
      ).map((s) => ({ label: s.deviceLabel, isCurrent: s.isCurrent }));
      expect(labelled).toEqual(
        expect.arrayContaining([
          { label: "Chrome on macOS", isCurrent: false },
          { label: "Safari on iOS", isCurrent: true },
        ]),
      );
    });

    it("GET /users/me/sessions excludes revoked sessions", async () => {
      const first = await signInAs({ sub: "user-revoke-list" });
      const second = await signInAs({ sub: "user-revoke-list" });

      await request(app.getHttpServer())
        .delete("/auth/session")
        .set("Cookie", `fortuna_session=${first.sessionToken}`)
        .expect(204);

      const listRes = await request(app.getHttpServer())
        .get("/users/me/sessions")
        .set("Cookie", `fortuna_session=${second.sessionToken}`)
        .expect(200);

      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].isCurrent).toBe(true);
    });

    it("DELETE /users/me/sessions/:id revokes a non-current session owned by the principal", async () => {
      const other = await signInAs({ sub: "user-revoke-other" });
      const current = await signInAs({ sub: "user-revoke-other" });

      // Find the other session's id.
      const sessionsRepo = dataSource.getRepository(Session);
      const otherSession = await sessionsRepo.findOne({
        where: { tokenHash: sha256Hex(other.sessionToken) },
      });
      if (!otherSession) throw new Error("expected other session");

      await request(app.getHttpServer())
        .delete(`/users/me/sessions/${otherSession.id}`)
        .set("Cookie", `fortuna_session=${current.sessionToken}`)
        .expect(204);

      const refreshed = await sessionsRepo.findOne({
        where: { id: otherSession.id },
      });
      expect(refreshed?.revokedAt).not.toBeNull();

      // The revoked session can no longer authenticate.
      await request(app.getHttpServer())
        .get("/users/me")
        .set("Cookie", `fortuna_session=${other.sessionToken}`)
        .expect(401);
    });

    it("DELETE /users/me/sessions/:id refuses to revoke the current session (400)", async () => {
      const current = await signInAs({ sub: "user-self-revoke" });

      const sessionsRepo = dataSource.getRepository(Session);
      const session = await sessionsRepo.findOne({
        where: { tokenHash: sha256Hex(current.sessionToken) },
      });
      if (!session) throw new Error("expected session");

      await request(app.getHttpServer())
        .delete(`/users/me/sessions/${session.id}`)
        .set("Cookie", `fortuna_session=${current.sessionToken}`)
        .expect(400);

      const refreshed = await sessionsRepo.findOne({
        where: { id: session.id },
      });
      expect(refreshed?.revokedAt).toBeNull();
    });

    it("DELETE /users/me/sessions/:id returns 404 (no info leak) when the session belongs to a different user", async () => {
      const victim = await signInAs({
        sub: "user-victim",
        email: "victim@example.com",
      });
      const attacker = await signInAs({
        sub: "user-attacker",
        email: "attacker@example.com",
      });
      expect(victim.userId).not.toBe(attacker.userId);

      const sessionsRepo = dataSource.getRepository(Session);
      const victimSession = await sessionsRepo.findOne({
        where: { tokenHash: sha256Hex(victim.sessionToken) },
      });
      if (!victimSession) throw new Error("expected victim session");

      await request(app.getHttpServer())
        .delete(`/users/me/sessions/${victimSession.id}`)
        .set("Cookie", `fortuna_session=${attacker.sessionToken}`)
        .expect(404);

      const refreshed = await sessionsRepo.findOne({
        where: { id: victimSession.id },
      });
      expect(refreshed?.revokedAt).toBeNull();
    });

    it("DELETE /users/me/sessions/:id returns 404 for a non-existent session id", async () => {
      const current = await signInAs({ sub: "user-404-session" });
      const fakeUuid = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .delete(`/users/me/sessions/${fakeUuid}`)
        .set("Cookie", `fortuna_session=${current.sessionToken}`)
        .expect(404);
    });
  });

  describe("sign-in event auditing", () => {
    it("records a success event for the user on a verified sign-in", async () => {
      const idToken = await signIdToken({ sub: "audit-success" });
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken, nonce: NONCE })
        .set("User-Agent", "Mozilla/5.0 (Macintosh; Audit/1.0)")
        .expect(201);
      expect(res.body.sessionToken).toEqual(expect.any(String));

      const events = await dataSource.getRepository(SignInEvent).find();
      expect(events).toHaveLength(1);
      const event = events[0];
      if (!event) throw new Error("expected one sign_in_event");

      expect(event.outcome).toBe("success");
      expect(event.userId).not.toBeNull();
      expect(event.correlationId).toEqual(expect.any(String));
      expect(event.ip).toBeTruthy();
      expect(event.uaHash).toMatch(/^[a-f0-9]{64}$/);
      expect(event.uaHash).toBe(
        createHash("sha256")
          .update("Mozilla/5.0 (Macintosh; Audit/1.0)")
          .digest("hex"),
      );
    });

    it("records a failure event with userId=null and exposes correlationId on the 401 body", async () => {
      const idToken = await signIdToken({ aud: "wrong-audience" });
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken, nonce: NONCE })
        .expect(401);

      expect(res.body.correlationId).toEqual(expect.any(String));

      const events = await dataSource.getRepository(SignInEvent).find();
      expect(events).toHaveLength(1);
      const event = events[0];
      if (!event) throw new Error("expected one sign_in_event");
      expect(event.outcome).toBe("failure_token_audience");
      expect(event.userId).toBeNull();
      expect(event.correlationId).toBe(res.body.correlationId);
    });

    it("records a failure_bad_request event when the body is empty", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({})
        .expect(400);
      expect(res.body.correlationId).toEqual(expect.any(String));

      const events = await dataSource.getRepository(SignInEvent).find();
      expect(events).toHaveLength(1);
      expect(events[0]?.outcome).toBe("failure_bad_request");
      expect(events[0]?.userId).toBeNull();
    });
  });

  describe("DELETE /users/me (account deletion)", () => {
    async function signInAs(opts: {
      sub?: string;
      email?: string;
    }): Promise<{ sessionToken: string; userId: string }> {
      const idToken = await signIdToken({ sub: opts.sub, email: opts.email });
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken, nonce: NONCE })
        .set("User-Agent", "Mozilla/5.0 (Macintosh; DeleteFlow/1.0)")
        .expect(201);
      const session = await dataSource.getRepository(Session).findOne({
        where: { tokenHash: sha256Hex(res.body.sessionToken) },
      });
      if (!session) throw new Error("expected session");
      return { sessionToken: res.body.sessionToken, userId: session.userId };
    }

    it("returns 400 when confirm is not true", async () => {
      const { sessionToken } = await signInAs({ sub: "delete-no-confirm" });

      const noBody = await request(app.getHttpServer())
        .delete("/users/me")
        .set("Cookie", `fortuna_session=${sessionToken}`)
        .send({})
        .expect(400);
      expect(noBody.body).toBeDefined();

      await request(app.getHttpServer())
        .delete("/users/me")
        .set("Cookie", `fortuna_session=${sessionToken}`)
        .send({ confirm: false })
        .expect(400);

      // Nothing was deleted.
      expect(await dataSource.getRepository(User).count()).toBe(1);
    });

    it("returns 401 when called without a session cookie", async () => {
      await request(app.getHttpServer())
        .delete("/users/me")
        .send({ confirm: true })
        .expect(401);
    });

    it("deletes the user (cascades sessions+identities), anonymizes sign_in_events, clears cookie, and 401s subsequent requests", async () => {
      const { sessionToken, userId } = await signInAs({ sub: "delete-me" });

      // Pre-state: 1 user, 1 identity, 1 session, 1 sign_in_event referencing the user.
      expect(await dataSource.getRepository(User).count()).toBe(1);
      expect(await dataSource.getRepository(Identity).count()).toBe(1);
      expect(await dataSource.getRepository(Session).count()).toBe(1);
      const eventsBefore = await dataSource
        .getRepository(SignInEvent)
        .findBy({ userId });
      expect(eventsBefore.length).toBeGreaterThan(0);
      expect(eventsBefore[0]?.ip).toBeTruthy();
      expect(eventsBefore[0]?.uaHash).toBeTruthy();

      const deleteRes = await request(app.getHttpServer())
        .delete("/users/me")
        .set("Cookie", `fortuna_session=${sessionToken}`)
        .send({ confirm: true })
        .expect(204);

      const setCookieHeader = deleteRes.headers["set-cookie"] as
        | string[]
        | string
        | undefined;
      const setCookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : setCookieHeader
          ? [setCookieHeader]
          : [];
      const clearHeader = setCookies.find((c) =>
        c.startsWith("fortuna_session="),
      );
      expect(clearHeader).toBeDefined();
      expect(clearHeader).toContain("Max-Age=0");

      // Cascade: user + identities + sessions are gone.
      expect(await dataSource.getRepository(User).count()).toBe(0);
      expect(await dataSource.getRepository(Identity).count()).toBe(0);
      expect(await dataSource.getRepository(Session).count()).toBe(0);

      // Anonymization: every sign_in_event row for the user has user_id, ip,
      // ua_hash nulled — but outcome + timestamp survive for forensics.
      const eventsAfter = await dataSource.getRepository(SignInEvent).find();
      expect(eventsAfter.length).toBeGreaterThan(0);
      for (const event of eventsAfter) {
        expect(event.userId).toBeNull();
        expect(event.ip).toBeNull();
        expect(event.uaHash).toBeNull();
        expect(event.outcome).toBeDefined();
        expect(event.createdAt).toBeInstanceOf(Date);
      }

      // The prior session cookie no longer authenticates.
      await request(app.getHttpServer())
        .get("/users/me")
        .set("Cookie", `fortuna_session=${sessionToken}`)
        .expect(401);
    });

    it("only deletes the principal's data, not other users", async () => {
      const victim = await signInAs({
        sub: "victim",
        email: "victim@example.com",
      });
      const survivor = await signInAs({
        sub: "survivor",
        email: "survivor@example.com",
      });
      expect(victim.userId).not.toBe(survivor.userId);

      await request(app.getHttpServer())
        .delete("/users/me")
        .set("Cookie", `fortuna_session=${victim.sessionToken}`)
        .send({ confirm: true })
        .expect(204);

      // Survivor's user, identity, session all intact.
      expect(await dataSource.getRepository(User).count()).toBe(1);
      expect(await dataSource.getRepository(Identity).count()).toBe(1);
      const survivingSessions = await dataSource.getRepository(Session).find();
      expect(survivingSessions).toHaveLength(1);
      expect(survivingSessions[0]?.userId).toBe(survivor.userId);

      // The survivor's sign_in_events still carry their user_id.
      const survivorEvents = await dataSource
        .getRepository(SignInEvent)
        .findBy({ userId: survivor.userId });
      expect(survivorEvents.length).toBeGreaterThan(0);
    });
  });

  describe("sign_in_events retention sweep", () => {
    it("clears ip + ua_hash on rows older than the retention window and leaves recent rows untouched", async () => {
      const repo = dataSource.getRepository(SignInEvent);
      const now = Date.now();
      const oldDate = new Date(now - 91 * 24 * 60 * 60 * 1000);
      const recentDate = new Date(now - 89 * 24 * 60 * 60 * 1000);

      // Use raw INSERT so we can set created_at explicitly (entity uses
      // @CreateDateColumn defaults).
      await repo.query(
        `INSERT INTO sign_in_events (id, user_id, correlation_id, outcome, ip, ua_hash, created_at)
         VALUES
           (uuid_generate_v4(), NULL, uuid_generate_v4(), 'success', '203.0.113.1', 'aaaa', $1),
           (uuid_generate_v4(), NULL, uuid_generate_v4(), 'success', '203.0.113.2', 'bbbb', $2)`,
        [oldDate.toISOString(), recentDate.toISOString()],
      );

      const worker = app.get(SignInEventsRetentionWorker);
      await worker.runRetentionSweep();

      const rows = await repo.find({ order: { createdAt: "ASC" } });
      expect(rows).toHaveLength(2);

      // Oldest row was anonymized.
      expect(rows[0]?.ip).toBeNull();
      expect(rows[0]?.uaHash).toBeNull();
      // Recent row untouched.
      expect(rows[1]?.ip).toBe("203.0.113.2");
      expect(rows[1]?.uaHash).toBe("bbbb");
    });

    it("clears the remaining column on a half-anonymized old row", async () => {
      const repo = dataSource.getRepository(SignInEvent);
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);

      await repo.query(
        `INSERT INTO sign_in_events (id, user_id, correlation_id, outcome, ip, ua_hash, created_at)
         VALUES
           (uuid_generate_v4(), NULL, uuid_generate_v4(), 'success', '203.0.113.3', NULL, $1),
           (uuid_generate_v4(), NULL, uuid_generate_v4(), 'success', NULL, 'cccc', $1)`,
        [oldDate.toISOString()],
      );

      const worker = app.get(SignInEventsRetentionWorker);
      await worker.runRetentionSweep();

      const rows = await repo.find({ order: { createdAt: "ASC" } });
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.ip).toBeNull();
        expect(row.uaHash).toBeNull();
      }
    });

    it("is idempotent — re-running the sweep on already-anonymized rows does not error", async () => {
      const repo = dataSource.getRepository(SignInEvent);
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);

      await repo.query(
        `INSERT INTO sign_in_events (id, user_id, correlation_id, outcome, ip, ua_hash, created_at)
         VALUES (uuid_generate_v4(), NULL, uuid_generate_v4(), 'success', NULL, NULL, $1)`,
        [oldDate.toISOString()],
      );

      const worker = app.get(SignInEventsRetentionWorker);
      await worker.runRetentionSweep();
      await worker.runRetentionSweep();

      const rows = await repo.find();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.ip).toBeNull();
      expect(rows[0]?.uaHash).toBeNull();
    });
  });

  describe("device fingerprinting", () => {
    const CHROME_MAC_UA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const FIREFOX_MAC_UA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0";

    it("inserts a fingerprint with first_seen_at and links it to the session on first sign-in", async () => {
      const idToken = await signIdToken({ sub: "fp-first" });
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken, nonce: NONCE, deviceId: "device-abc" })
        .set("User-Agent", CHROME_MAC_UA)
        .expect(201);

      const fingerprints = await dataSource
        .getRepository(DeviceFingerprint)
        .find();
      expect(fingerprints).toHaveLength(1);
      const fingerprint = fingerprints[0];
      if (!fingerprint) throw new Error("expected one fingerprint");

      expect(fingerprint.fingerprintHash).toBe(
        computeDeviceFingerprintHash("device-abc", CHROME_MAC_UA),
      );
      expect(fingerprint.firstSeenAt).toBeInstanceOf(Date);
      expect(fingerprint.lastSeenAt).toBeInstanceOf(Date);
      // Raw device id is never persisted.
      const fingerprintRow = await dataSource.query(
        "SELECT id::text, fingerprint_hash FROM device_fingerprints LIMIT 1",
      );
      expect(JSON.stringify(fingerprintRow)).not.toContain("device-abc");

      const session = await dataSource.getRepository(Session).findOne({
        where: { tokenHash: sha256Hex(res.body.sessionToken) },
      });
      expect(session?.deviceFingerprintId).toBe(fingerprint.id);
    });

    it("updates last_seen_at and reuses the fingerprint row on a repeat sign-in from the same device", async () => {
      const sub = "fp-repeat";

      const first = await request(app.getHttpServer())
        .post("/auth/google")
        .send({
          idToken: await signIdToken({ sub }),
          nonce: NONCE,
          deviceId: "device-abc",
        })
        .set("User-Agent", CHROME_MAC_UA)
        .expect(201);

      const before = await dataSource
        .getRepository(DeviceFingerprint)
        .findOne({ where: {} });
      expect(before).not.toBeNull();
      const firstSeenAt = before?.firstSeenAt;
      const lastSeenAfterFirst = before?.lastSeenAt;

      // Sleep just enough for the timestamp to move forward measurably.
      await new Promise((r) => setTimeout(r, 25));

      const second = await request(app.getHttpServer())
        .post("/auth/google")
        .send({
          idToken: await signIdToken({ sub }),
          nonce: NONCE,
          deviceId: "device-abc",
        })
        .set("User-Agent", CHROME_MAC_UA)
        .expect(201);

      const fingerprints = await dataSource
        .getRepository(DeviceFingerprint)
        .find();
      expect(fingerprints).toHaveLength(1);
      const fingerprint = fingerprints[0];
      if (!fingerprint) throw new Error("expected one fingerprint");
      expect(fingerprint.firstSeenAt.getTime()).toBe(firstSeenAt?.getTime());
      expect(fingerprint.lastSeenAt.getTime()).toBeGreaterThan(
        lastSeenAfterFirst?.getTime() ?? 0,
      );

      const sessions = await dataSource.getRepository(Session).find();
      expect(sessions).toHaveLength(2);
      for (const session of sessions) {
        expect(session.deviceFingerprintId).toBe(fingerprint.id);
      }
      // Both raw tokens reachable in the responses.
      expect(first.body.sessionToken).not.toBe(second.body.sessionToken);
    });

    it("treats a cleared device_id cookie as a new device (new fingerprint row)", async () => {
      const sub = "fp-cleared";

      await request(app.getHttpServer())
        .post("/auth/google")
        .send({
          idToken: await signIdToken({ sub }),
          nonce: NONCE,
          deviceId: "device-old",
        })
        .set("User-Agent", CHROME_MAC_UA)
        .expect(201);

      await request(app.getHttpServer())
        .post("/auth/google")
        .send({
          idToken: await signIdToken({ sub }),
          nonce: NONCE,
          deviceId: "device-new",
        })
        .set("User-Agent", CHROME_MAC_UA)
        .expect(201);

      const fingerprints = await dataSource
        .getRepository(DeviceFingerprint)
        .find({ order: { firstSeenAt: "ASC" } });
      expect(fingerprints).toHaveLength(2);
      expect(fingerprints[0]?.fingerprintHash).not.toBe(
        fingerprints[1]?.fingerprintHash,
      );
    });

    it("treats a different UA family as a new device even when the device_id is the same", async () => {
      const sub = "fp-ua-family";

      await request(app.getHttpServer())
        .post("/auth/google")
        .send({
          idToken: await signIdToken({ sub }),
          nonce: NONCE,
          deviceId: "device-shared",
        })
        .set("User-Agent", CHROME_MAC_UA)
        .expect(201);

      await request(app.getHttpServer())
        .post("/auth/google")
        .send({
          idToken: await signIdToken({ sub }),
          nonce: NONCE,
          deviceId: "device-shared",
        })
        .set("User-Agent", FIREFOX_MAC_UA)
        .expect(201);

      const fingerprints = await dataSource
        .getRepository(DeviceFingerprint)
        .find();
      expect(fingerprints).toHaveLength(2);
    });

    it("leaves device_fingerprint_id null on the session when no device_id is forwarded", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken: await signIdToken({ sub: "fp-none" }), nonce: NONCE })
        .set("User-Agent", CHROME_MAC_UA)
        .expect(201);

      expect(await dataSource.getRepository(DeviceFingerprint).count()).toBe(0);

      const session = await dataSource.getRepository(Session).findOne({
        where: { tokenHash: sha256Hex(res.body.sessionToken) },
      });
      expect(session?.deviceFingerprintId).toBeNull();
    });

    it("cascades device_fingerprints on user delete (cascade contract regression)", async () => {
      const idToken = await signIdToken({ sub: "fp-cascade" });
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken, nonce: NONCE, deviceId: "device-cascade" })
        .set("User-Agent", CHROME_MAC_UA)
        .expect(201);

      await request(app.getHttpServer())
        .delete("/users/me")
        .set("Cookie", `fortuna_session=${res.body.sessionToken}`)
        .send({ confirm: true })
        .expect(204);

      expect(await dataSource.getRepository(User).count()).toBe(0);
      expect(await dataSource.getRepository(DeviceFingerprint).count()).toBe(0);
    });
  });

  describe("rate limiting", () => {
    it("blocks at the per-IP threshold and audits failure_rate_limited", async () => {
      limiterConfig.ip.limit = 3;

      // First three attempts pass the limiter (they each fail verification —
      // that's fine; the IP counter increments on every attempt).
      for (let i = 0; i < 3; i++) {
        const idToken = await signIdToken({
          aud: "wrong-audience",
          sub: `ip-rl-${i}`,
        });
        await request(app.getHttpServer())
          .post("/auth/google")
          .send({ idToken, nonce: NONCE })
          .expect(401);
      }

      // Fourth attempt is blocked by the IP limiter.
      const blockedIdToken = await signIdToken({
        aud: "wrong-audience",
        sub: "ip-rl-blocked",
      });
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken: blockedIdToken, nonce: NONCE })
        .expect(401);

      expect(res.body.correlationId).toEqual(expect.any(String));

      const events = await dataSource
        .getRepository(SignInEvent)
        .find({ order: { createdAt: "ASC" } });
      expect(events).toHaveLength(4);
      const last = events[events.length - 1];
      expect(last?.outcome).toBe("failure_rate_limited");
      expect(last?.correlationId).toBe(res.body.correlationId);
    });

    it("applies identity-scoped backoff after repeated failures for the same identity", async () => {
      // threshold=2, baseMs=300, capMs=2000

      // Three failures for the same sub push the failure counter past the
      // threshold, so the next attempt should be in cooldown.
      for (let i = 0; i < 3; i++) {
        const idToken = await signIdToken({
          aud: "wrong-audience",
          sub: "identity-backoff",
        });
        const res = await request(app.getHttpServer())
          .post("/auth/google")
          .send({ idToken, nonce: NONCE })
          .expect(401);
        expect(res.body.correlationId).toEqual(expect.any(String));
      }

      const blockedIdToken = await signIdToken({
        aud: "wrong-audience",
        sub: "identity-backoff",
      });
      const blocked = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken: blockedIdToken, nonce: NONCE })
        .expect(401);

      const events = await dataSource
        .getRepository(SignInEvent)
        .find({ order: { createdAt: "ASC" } });
      const lastOutcome = events[events.length - 1]?.outcome;
      expect(lastOutcome).toBe("failure_rate_limited");
      expect(events[events.length - 1]?.correlationId).toBe(
        blocked.body.correlationId,
      );

      // A *different* identity is not affected by sub="identity-backoff"'s
      // cooldown — separate keyspace per (provider, subject).
      const otherIdToken = await signIdToken({
        aud: "wrong-audience",
        sub: "different-identity",
      });
      const other = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken: otherIdToken, nonce: NONCE })
        .expect(401);
      const eventsAfter = await dataSource
        .getRepository(SignInEvent)
        .find({ order: { createdAt: "ASC" } });
      const lastForOther = eventsAfter[eventsAfter.length - 1];
      expect(lastForOther?.outcome).toBe("failure_token_audience");
      expect(lastForOther?.correlationId).toBe(other.body.correlationId);
    });

    it("clears identity backoff state after a successful sign-in", async () => {
      // Push the identity counter to threshold (but not over).
      for (let i = 0; i < 2; i++) {
        const idToken = await signIdToken({
          aud: "wrong-audience",
          sub: "clear-on-success",
        });
        await request(app.getHttpServer())
          .post("/auth/google")
          .send({ idToken, nonce: NONCE })
          .expect(401);
      }

      // Successful sign-in clears the failure counter.
      const goodIdToken = await signIdToken({ sub: "clear-on-success" });
      await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken: goodIdToken, nonce: NONCE })
        .expect(201);

      // Three more failures must be tolerated — backoff threshold (2) is
      // counted from zero again because clearIdentityFailures wiped the key.
      for (let i = 0; i < 2; i++) {
        const idToken = await signIdToken({
          aud: "wrong-audience",
          sub: "clear-on-success",
        });
        await request(app.getHttpServer())
          .post("/auth/google")
          .send({ idToken, nonce: NONCE })
          .expect(401);
      }
      const events = await dataSource.getRepository(SignInEvent).find();
      // None of the post-success failures should be rate-limited.
      const postSuccessFailures = events.filter(
        (e) => e.outcome === "failure_token_audience",
      );
      expect(postSuccessFailures.length).toBeGreaterThanOrEqual(4);
      expect(events.some((e) => e.outcome === "failure_rate_limited")).toBe(
        false,
      );
    });

    it("fails open when Redis is unreachable: sign-ins succeed and degradedCount increments", async () => {
      const limiter = app.get(SlidingWindowLimiter);
      const baselineDegraded = limiter.degradedCount();

      // Stop Redis for the rest of the test file (this case must run last).
      const stoppingRedis = redisContainer;
      redisContainer = null;
      await stoppingRedis?.stop();
      await redisAdmin?.quit().catch(() => undefined);

      const idToken = await signIdToken({ sub: "fail-open" });
      const res = await request(app.getHttpServer())
        .post("/auth/google")
        .send({ idToken, nonce: NONCE })
        .expect(201);

      expect(res.body.sessionToken).toEqual(expect.any(String));
      expect(limiter.degradedCount()).toBeGreaterThan(baselineDegraded);
      expect(limiter.isDegraded()).toBe(true);
    });
  });
});
