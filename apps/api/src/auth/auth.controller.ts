import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { buildClearSessionCookieHeader } from "./cookies/session-cookie";
import type { SignInOutcome } from "./entities/sign-in-event.entity";
import { SessionGuard } from "./guards/session.guard";
import {
  GoogleIdTokenVerifier,
  IdTokenVerificationError,
  type IdTokenVerificationReason,
} from "./services/google-id-token-verifier";
import { SessionsService } from "./services/sessions.service";
import { SignInEventsService } from "./services/sign-in-events.service";
import { UsersService } from "./services/users.service";

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
}

/** Request body for `POST /auth/google`. */
export interface GoogleSignInDto {
  /** Google ID token (JWT) obtained by apps/web during the OAuth exchange. */
  idToken: string;
  /** Nonce that apps/web included in the OAuth `authorize` request. */
  nonce: string;
}

/** Response body for `POST /auth/google`. */
export interface GoogleSignInResponse {
  /**
   * Opaque session token. apps/web is responsible for setting this as the
   * session cookie on the user-agent — it never round-trips through the
   * browser otherwise.
   */
  sessionToken: string;
  /** Session expiry as an ISO-8601 timestamp. */
  expiresAt: string;
}

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly verifier: GoogleIdTokenVerifier,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly signInEvents: SignInEventsService,
  ) {}

  /**
   * Verify a Google ID token forwarded by apps/web, upsert the user +
   * identity, mint a session, and return the opaque token.
   *
   * Every attempt — success or failure — appends a row to `sign_in_events`
   * with a fresh `correlation_id`. Failures surface that id in the response
   * body so support can map a user-reported error to the audit row without
   * leaking the internal failure reason.
   */
  @Post("google")
  async googleSignIn(
    @Body() body: GoogleSignInDto,
    @Req() req: Request,
  ): Promise<GoogleSignInResponse> {
    const correlationId = randomUUID();
    const userAgent = headerString(req.headers["user-agent"]) ?? null;
    const ip = req.ip ?? null;

    if (
      !body ||
      typeof body.idToken !== "string" ||
      !body.idToken ||
      typeof body.nonce !== "string" ||
      !body.nonce
    ) {
      await this.recordSafely({
        userId: null,
        correlationId,
        outcome: "failure_bad_request",
        ip,
        userAgent,
      });
      throw new BadRequestException({ correlationId });
    }

    let claims: Awaited<ReturnType<GoogleIdTokenVerifier["verify"]>>;
    try {
      claims = await this.verifier.verify(body.idToken, body.nonce);
    } catch (err) {
      if (err instanceof IdTokenVerificationError) {
        const outcome = outcomeFromVerificationReason(err.reason);
        this.logger.warn(
          `Sign-in verification failed (${err.reason}) [cid=${correlationId}]`,
        );
        await this.recordSafely({
          userId: null,
          correlationId,
          outcome,
          ip,
          userAgent,
        });
        throw new UnauthorizedException({ correlationId });
      }
      await this.recordSafely({
        userId: null,
        correlationId,
        outcome: "failure_internal",
        ip,
        userAgent,
      });
      throw err;
    }

    const user = await this.users.upsertFromGoogleIdentity(claims);

    const { rawToken, session } = await this.sessions.mint({
      userId: user.id,
      userAgent,
      ip,
    });

    await this.recordSafely({
      userId: user.id,
      correlationId,
      outcome: "success",
      ip,
      userAgent,
    });

    return {
      sessionToken: rawToken,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /**
   * Sign out the current device.
   *
   * Marks the principal's session `revoked_at = now()` and instructs the
   * browser to drop the session cookie. Idempotent — re-signing-out is a
   * no-op apart from moving the revoked timestamp forward.
   */
  @UseGuards(SessionGuard)
  @Delete("session")
  @HttpCode(204)
  async signOut(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const principal = req.principal;
    if (!principal) throw new UnauthorizedException();

    await this.sessions.revoke(principal.sessionId);
    res.setHeader("Set-Cookie", buildClearSessionCookieHeader());
  }

  private async recordSafely(input: {
    userId: string | null;
    correlationId: string;
    outcome: SignInOutcome;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void> {
    try {
      await this.signInEvents.record(input);
    } catch (err) {
      this.logger.error(
        `Failed to persist sign_in_events row [cid=${input.correlationId}]`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}

function outcomeFromVerificationReason(
  reason: IdTokenVerificationReason,
): SignInOutcome {
  switch (reason) {
    case "signature":
      return "failure_token_signature";
    case "expired":
      return "failure_token_expired";
    case "issuer":
      return "failure_token_issuer";
    case "audience":
      return "failure_token_audience";
    case "nonce_mismatch":
      return "failure_nonce_mismatch";
    case "malformed":
      return "failure_token_malformed";
  }
}

function headerString(
  header: string | string[] | undefined,
): string | undefined {
  if (header === undefined) return undefined;
  return Array.isArray(header) ? header.join(", ") : header;
}
