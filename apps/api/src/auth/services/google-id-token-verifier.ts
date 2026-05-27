import { Inject, Injectable } from "@nestjs/common";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  type JSONWebKeySet,
  type JWTPayload,
  type JWTVerifyGetKey,
  errors as joseErrors,
  jwtVerify,
} from "jose";

/**
 * Reason an ID token verification failed.
 *
 * These map to the design's internal sign-in outcome classifications.
 * Callers translate this into a single user-visible 401 — the reason is for
 * server-side logging / forensics only.
 */
export type IdTokenVerificationReason =
  | "signature"
  | "expired"
  | "issuer"
  | "audience"
  | "nonce_mismatch"
  | "malformed";

/** Thrown by {@link GoogleIdTokenVerifier.verify} on any verification failure. */
export class IdTokenVerificationError extends Error {
  constructor(public readonly reason: IdTokenVerificationReason) {
    super(`ID token verification failed: ${reason}`);
    this.name = "IdTokenVerificationError";
  }
}

/** Subset of Google ID token claims Fortuna consumes. */
export interface IdTokenClaims {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Constructor options for {@link GoogleIdTokenVerifier}.
 *
 * Exactly one of `jwks` (local key set, for tests) or `jwksUri` (remote JWKS
 * fetched and cached by `jose`) must be provided.
 */
export interface GoogleIdTokenVerifierOptions {
  issuer: string;
  audience: string;
  jwksUri?: string;
  jwks?: JSONWebKeySet;
  /** Allowed skew when checking `exp`. Default 60 seconds. */
  clockToleranceSeconds?: number;
}

/** DI token for {@link GoogleIdTokenVerifierOptions}. */
export const GOOGLE_ID_TOKEN_VERIFIER_OPTIONS = Symbol(
  "GOOGLE_ID_TOKEN_VERIFIER_OPTIONS",
);

/**
 * Verifies Google ID tokens against a JWKS, the configured issuer and
 * audience, expiry (with bounded clock skew), and the expected nonce.
 *
 * Fails closed for every class of mismatch — the exact reason is exposed via
 * {@link IdTokenVerificationError.reason} so callers can record a forensic
 * outcome without leaking detail to the client.
 */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly getKey: JWTVerifyGetKey;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly clockToleranceSeconds: number;

  constructor(
    @Inject(GOOGLE_ID_TOKEN_VERIFIER_OPTIONS)
    options: GoogleIdTokenVerifierOptions,
  ) {
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.clockToleranceSeconds = options.clockToleranceSeconds ?? 60;

    if (options.jwks) {
      this.getKey = createLocalJWKSet(options.jwks);
    } else if (options.jwksUri) {
      this.getKey = createRemoteJWKSet(new URL(options.jwksUri));
    } else {
      throw new Error("GoogleIdTokenVerifier requires jwks or jwksUri");
    }
  }

  /**
   * Verify an ID token and return its claims.
   *
   * Throws {@link IdTokenVerificationError} on any failure (signature,
   * expired, issuer/audience mismatch, nonce mismatch, malformed).
   */
  async verify(idToken: string, expectedNonce: string): Promise<IdTokenClaims> {
    const payload = await this.verifyToken(idToken);

    if (typeof payload.nonce !== "string" || payload.nonce !== expectedNonce) {
      throw new IdTokenVerificationError("nonce_mismatch");
    }

    return this.toClaims(payload);
  }

  private async verifyToken(idToken: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(idToken, this.getKey, {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockToleranceSeconds,
      });
      return payload;
    } catch (err) {
      throw new IdTokenVerificationError(reasonFromJoseError(err));
    }
  }

  private toClaims(payload: JWTPayload): IdTokenClaims {
    if (typeof payload.sub !== "string") {
      throw new IdTokenVerificationError("malformed");
    }
    if (typeof payload.email !== "string") {
      throw new IdTokenVerificationError("malformed");
    }
    if (typeof payload.name !== "string") {
      throw new IdTokenVerificationError("malformed");
    }
    const claims: IdTokenClaims = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
    };
    if (typeof payload.picture === "string") {
      claims.picture = payload.picture;
    }
    return claims;
  }
}

function reasonFromJoseError(err: unknown): IdTokenVerificationReason {
  if (err instanceof joseErrors.JWTExpired) return "expired";
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    if (err.claim === "iss") return "issuer";
    if (err.claim === "aud") return "audience";
    return "malformed";
  }
  if (err instanceof joseErrors.JWSSignatureVerificationFailed)
    return "signature";
  if (err instanceof joseErrors.JWKSNoMatchingKey) return "signature";
  if (err instanceof joseErrors.JWSInvalid) return "malformed";
  if (err instanceof joseErrors.JWTInvalid) return "malformed";
  return "malformed";
}
