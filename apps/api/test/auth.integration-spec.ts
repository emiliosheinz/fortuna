import { createHash } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "@/app.module";
import { Identity } from "@/auth/entities/identity.entity";
import { Session } from "@/auth/entities/session.entity";
import { SignInEvent } from "@/auth/entities/sign-in-event.entity";
import { User } from "@/auth/entities/user.entity";
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

    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = String(container.getMappedPort(5432));
    process.env.DB_NAME = container.getDatabase();
    process.env.DB_USER = container.getUsername();
    process.env.DB_PASSWORD = container.getPassword();
    process.env.DB_SSL = "false";

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
    await container?.stop();
  });

  beforeEach(async () => {
    if (!dataSource) return;
    await dataSource.query(
      'TRUNCATE TABLE "sign_in_events", "sessions", "identities", "users" RESTART IDENTITY CASCADE',
    );
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
  });
});
