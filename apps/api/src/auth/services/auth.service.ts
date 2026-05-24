import { randomUUID } from "node:crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { decodeJwt } from "jose";
import type { GoogleSignInDto } from "../dto/google-sign-in.dto";
import {
  type IdentityKey,
  SlidingWindowLimiter,
} from "../rate-limit/sliding-window-limiter";
import { DeviceFingerprintsService } from "./device-fingerprints.service";
import {
  GoogleIdTokenVerifier,
  IdTokenVerificationError,
} from "./google-id-token-verifier";
import { SessionsService } from "./sessions.service";
import { SignInAuditor } from "./sign-in-auditor";
import { UsersService } from "./users.service";

const PROVIDER = "google";

/** Caller-supplied request metadata recorded on every audit row. */
export interface SignInRequestMetadata {
  ip: string | null;
  userAgent: string | null;
}

/** Result returned to the controller for the `POST /auth/google` response. */
export interface GoogleSignInResult {
  sessionToken: string;
  expiresAt: string;
}

/**
 * Orchestrates the Google sign-in pipeline: rate-limit, verify the ID
 * token, upsert the user + identity, mint a session, and audit the
 * outcome.
 *
 * The controller is intentionally a thin HTTP adapter — all sign-in
 * policy lives here. Rate-limit rejections, verification failures and
 * successes are all audited via {@link SignInAuditor}; HTTP status
 * mapping (success vs `UnauthorizedException` for rate-limited /
 * verification failures, bubbling for everything else) is the
 * controller's view of the world but is shaped at this layer so the
 * controller stays trivial.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly verifier: GoogleIdTokenVerifier,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly fingerprints: DeviceFingerprintsService,
    private readonly auditor: SignInAuditor,
    private readonly limiter: SlidingWindowLimiter,
  ) {}

  async signInWithGoogle(
    dto: GoogleSignInDto,
    meta: SignInRequestMetadata,
  ): Promise<GoogleSignInResult> {
    const correlationId = randomUUID();

    await this.enforceIpRate(correlationId, meta);
    const identity = decodeIdentity(dto.idToken);
    if (identity) {
      await this.enforceIdentityBackoff(identity, correlationId, meta);
    }

    const claims = await this.verifyOrAudit(dto, meta, correlationId, identity);
    const user = await this.users.upsertFromGoogleIdentity(claims);
    const { fingerprintId } = await this.fingerprints.recordSignIn({
      userId: user.id,
      deviceId: dto.deviceId ?? null,
      userAgent: meta.userAgent,
    });
    const { rawToken, session } = await this.sessions.mint({
      userId: user.id,
      userAgent: meta.userAgent,
      ip: meta.ip,
      deviceFingerprintId: fingerprintId,
    });

    await this.auditor.recordSuccess({
      userId: user.id,
      correlationId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await this.limiter.clearIdentityFailures({
      provider: PROVIDER,
      subject: claims.sub,
    });

    return {
      sessionToken: rawToken,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private async enforceIpRate(
    correlationId: string,
    meta: SignInRequestMetadata,
  ): Promise<void> {
    const decision = await this.limiter.checkIpRate(meta.ip);
    if (decision.allowed) return;
    this.logger.warn(
      `Sign-in blocked by IP limiter (ip=${meta.ip}, retryAfterMs=${decision.retryAfterMs}) [cid=${correlationId}]`,
    );
    await this.auditor.recordRateLimited({
      correlationId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new UnauthorizedException({ correlationId });
  }

  private async enforceIdentityBackoff(
    identity: IdentityKey,
    correlationId: string,
    meta: SignInRequestMetadata,
  ): Promise<void> {
    const decision = await this.limiter.checkIdentityBackoff(identity);
    if (decision.allowed) return;
    this.logger.warn(
      `Sign-in blocked by identity backoff (sub=${identity.subject}, retryAfterMs=${decision.retryAfterMs}) [cid=${correlationId}]`,
    );
    await this.auditor.recordRateLimited({
      correlationId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new UnauthorizedException({ correlationId });
  }

  private async verifyOrAudit(
    dto: GoogleSignInDto,
    meta: SignInRequestMetadata,
    correlationId: string,
    identity: IdentityKey | null,
  ) {
    try {
      return await this.verifier.verify(dto.idToken, dto.nonce);
    } catch (err) {
      if (err instanceof IdTokenVerificationError) {
        this.logger.warn(
          `Sign-in verification failed (${err.reason}) [cid=${correlationId}]`,
        );
        await this.auditor.recordVerificationFailure({
          reason: err.reason,
          correlationId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        if (identity) {
          await this.limiter.recordIdentityFailure(identity);
        }
        throw new UnauthorizedException({ correlationId });
      }
      await this.auditor.recordInternalFailure({
        correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw err;
    }
  }
}

/**
 * Peek at the unverified JWT payload to extract `(provider, sub)` for
 * the identity-backoff lookup. A malformed token surfaces as `null` and
 * the caller skips the identity check — the verifier will reject the
 * token a moment later with `failure_token_malformed`.
 */
function decodeIdentity(idToken: string): IdentityKey | null {
  try {
    const claims = decodeJwt(idToken);
    if (typeof claims.sub !== "string" || claims.sub.length === 0) return null;
    return { provider: PROVIDER, subject: claims.sub };
  } catch {
    return null;
  }
}
