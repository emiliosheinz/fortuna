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
import { SessionGuard } from "./guards/session.guard";
import {
  GoogleIdTokenVerifier,
  IdTokenVerificationError,
} from "./services/google-id-token-verifier";
import { SessionsService } from "./services/sessions.service";
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
  ) {}

  /**
   * Verify a Google ID token forwarded by apps/web, upsert the user +
   * identity, mint a session, and return the opaque token.
   *
   * Responds 401 (no internal detail) for any token-verification failure;
   * the specific reason is logged via {@link Logger} for forensics.
   */
  @Post("google")
  async googleSignIn(
    @Body() body: GoogleSignInDto,
    @Req() req: Request,
  ): Promise<GoogleSignInResponse> {
    if (
      !body ||
      typeof body.idToken !== "string" ||
      !body.idToken ||
      typeof body.nonce !== "string" ||
      !body.nonce
    ) {
      throw new BadRequestException();
    }

    let claims: Awaited<ReturnType<GoogleIdTokenVerifier["verify"]>>;
    try {
      claims = await this.verifier.verify(body.idToken, body.nonce);
    } catch (err) {
      if (err instanceof IdTokenVerificationError) {
        this.logger.warn(`Sign-in verification failed (${err.reason})`);
        throw new UnauthorizedException();
      }
      throw err;
    }

    const user = await this.users.upsertFromGoogleIdentity(claims);

    const userAgent = headerString(req.headers["user-agent"]) ?? null;
    const ip = req.ip ?? null;

    const { rawToken, session } = await this.sessions.mint({
      userId: user.id,
      userAgent,
      ip,
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
}

function headerString(
  header: string | string[] | undefined,
): string | undefined {
  if (header === undefined) return undefined;
  return Array.isArray(header) ? header.join(", ") : header;
}
