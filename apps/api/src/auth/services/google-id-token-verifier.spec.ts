import {
  type CryptoKey,
  exportJWK,
  generateKeyPair,
  type JWK,
  SignJWT,
} from "jose";
import {
  GoogleIdTokenVerifier,
  IdTokenVerificationError,
} from "./google-id-token-verifier";

const ISSUER = "https://accounts.google.com";
const AUDIENCE = "fortuna-client-id";
const NONCE = "test-nonce-123";

type SignOpts = {
  iss?: string;
  aud?: string;
  nonce?: string;
  exp?: number;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

class TestKeyset {
  constructor(
    readonly privateKey: CryptoKey,
    readonly publicJwk: JWK,
    readonly kid: string,
  ) {}

  async sign(opts: SignOpts = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      nonce: opts.nonce ?? NONCE,
      email: opts.email ?? "user@example.com",
      name: opts.name ?? "User Example",
      picture: opts.picture,
    })
      .setProtectedHeader({ alg: "RS256", kid: this.kid })
      .setIssuer(opts.iss ?? ISSUER)
      .setAudience(opts.aud ?? AUDIENCE)
      .setSubject(opts.sub ?? "google-sub-12345")
      .setIssuedAt(now)
      .setExpirationTime(opts.exp ?? now + 600)
      .sign(this.privateKey);
  }
}

async function newKeyset(kid = "test-kid"): Promise<TestKeyset> {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.alg = "RS256";
  jwk.use = "sig";
  jwk.kid = kid;
  return new TestKeyset(privateKey, jwk, kid);
}

function makeVerifier(jwks: { keys: JWK[] }): GoogleIdTokenVerifier {
  return new GoogleIdTokenVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwks,
  });
}

describe("GoogleIdTokenVerifier", () => {
  it("returns claims for a valid token", async () => {
    const keyset = await newKeyset();
    const token = await keyset.sign({
      sub: "abc-123",
      email: "alice@example.com",
      name: "Alice",
      picture: "https://example.com/a.png",
    });

    const verifier = makeVerifier({ keys: [keyset.publicJwk] });
    const claims = await verifier.verify(token, NONCE);

    expect(claims).toEqual({
      sub: "abc-123",
      email: "alice@example.com",
      name: "Alice",
      picture: "https://example.com/a.png",
    });
  });

  it("rejects a token signed by an unknown key", async () => {
    const issuingKeyset = await newKeyset("issuing");
    const trustedKeyset = await newKeyset("trusted");
    const token = await issuingKeyset.sign();

    const verifier = makeVerifier({ keys: [trustedKeyset.publicJwk] });

    await expect(verifier.verify(token, NONCE)).rejects.toMatchObject({
      reason: "signature",
    });
  });

  it("rejects an expired token", async () => {
    const keyset = await newKeyset();
    const token = await keyset.sign({ exp: Math.floor(Date.now() / 1000) - 120 });

    const verifier = makeVerifier({ keys: [keyset.publicJwk] });

    await expect(verifier.verify(token, NONCE)).rejects.toMatchObject({
      reason: "expired",
    });
  });

  it("rejects a token from the wrong issuer", async () => {
    const keyset = await newKeyset();
    const token = await keyset.sign({ iss: "https://evil.example.com" });

    const verifier = makeVerifier({ keys: [keyset.publicJwk] });

    await expect(verifier.verify(token, NONCE)).rejects.toMatchObject({
      reason: "issuer",
    });
  });

  it("rejects a token for the wrong audience", async () => {
    const keyset = await newKeyset();
    const token = await keyset.sign({ aud: "some-other-client-id" });

    const verifier = makeVerifier({ keys: [keyset.publicJwk] });

    await expect(verifier.verify(token, NONCE)).rejects.toMatchObject({
      reason: "audience",
    });
  });

  it("rejects a token with a mismatched nonce", async () => {
    const keyset = await newKeyset();
    const token = await keyset.sign({ nonce: "different-nonce" });

    const verifier = makeVerifier({ keys: [keyset.publicJwk] });

    await expect(verifier.verify(token, NONCE)).rejects.toMatchObject({
      reason: "nonce_mismatch",
    });
  });

  it("rejects a malformed token", async () => {
    const keyset = await newKeyset();
    const verifier = makeVerifier({ keys: [keyset.publicJwk] });

    await expect(verifier.verify("not-a-jwt", NONCE)).rejects.toMatchObject({
      reason: "malformed",
    });
  });

  it("error reason is exposed as a typed property", async () => {
    const keyset = await newKeyset();
    const token = await keyset.sign({ exp: Math.floor(Date.now() / 1000) - 120 });
    const verifier = makeVerifier({ keys: [keyset.publicJwk] });

    let caught: unknown;
    try {
      await verifier.verify(token, NONCE);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(IdTokenVerificationError);
  });

  it("accepts tokens within the configured clock tolerance", async () => {
    const keyset = await newKeyset();
    const token = await keyset.sign({ exp: Math.floor(Date.now() / 1000) - 10 });

    const verifier = makeVerifier({ keys: [keyset.publicJwk] });

    await expect(verifier.verify(token, NONCE)).resolves.toMatchObject({
      sub: "google-sub-12345",
    });
  });
});
