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
import { User } from "@/auth/entities/user.entity";
import {
  GOOGLE_ID_TOKEN_VERIFIER_OPTIONS,
  type GoogleIdTokenVerifierOptions,
} from "@/auth/services/google-id-token-verifier";

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
      'TRUNCATE TABLE "sessions", "identities", "users" RESTART IDENTITY CASCADE',
    );
  });

  async function signIdToken(
    overrides: { aud?: string; sub?: string; name?: string } = {},
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      nonce: NONCE,
      name: overrides.name ?? "Integration User",
      email: "int@example.com",
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
});
