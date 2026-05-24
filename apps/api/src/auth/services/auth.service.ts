import { randomUUID } from "node:crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { GoogleSignInDto } from "../dto/google-sign-in.dto";
import {
  GoogleIdTokenVerifier,
  IdTokenVerificationError,
} from "./google-id-token-verifier";
import { SessionsService } from "./sessions.service";
import { SignInAuditor } from "./sign-in-auditor";
import { UsersService } from "./users.service";

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
 * Orchestrates the Google sign-in pipeline: verify the ID token, upsert the
 * user + identity, mint a session, and audit the outcome.
 *
 * The controller is intentionally a thin HTTP adapter — all sign-in policy
 * lives here. Audit writes are delegated to {@link SignInAuditor}; HTTP
 * status mapping (success vs `UnauthorizedException` for verification
 * failures, bubbling for everything else) is the controller's view of the
 * world but is shaped at this layer so the controller stays trivial.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly verifier: GoogleIdTokenVerifier,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly auditor: SignInAuditor,
  ) {}

  async signInWithGoogle(
    dto: GoogleSignInDto,
    meta: SignInRequestMetadata,
  ): Promise<GoogleSignInResult> {
    const correlationId = randomUUID();

    const claims = await this.verifyOrAudit(dto, meta, correlationId);
    const user = await this.users.upsertFromGoogleIdentity(claims);
    const { rawToken, session } = await this.sessions.mint({
      userId: user.id,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.auditor.recordSuccess({
      userId: user.id,
      correlationId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      sessionToken: rawToken,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private async verifyOrAudit(
    dto: GoogleSignInDto,
    meta: SignInRequestMetadata,
    correlationId: string,
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
