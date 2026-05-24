import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { buildClearSessionCookieHeader } from "./cookies/session-cookie";
import { GoogleSignInDto } from "./dto/google-sign-in.dto";
import { BadRequestAuditFilter } from "./filters/bad-request-audit.filter";
import { SessionGuard } from "./guards/session.guard";
import { AuthService } from "./services/auth.service";
import { SessionsService } from "./services/sessions.service";

interface AuthedRequest extends Request {
  principal?: { userId: string; sessionId: string };
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
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * Verify a Google ID token forwarded by apps/web and mint a session.
   *
   * Validation is enforced by the global `ValidationPipe` against
   * {@link GoogleSignInDto}; bad-request failures are caught by
   * {@link BadRequestAuditFilter} so they still produce an audit row.
   * Orchestration of verify + upsert + mint lives in {@link AuthService}.
   */
  @Post("google")
  @UseFilters(BadRequestAuditFilter)
  async googleSignIn(
    @Body() dto: GoogleSignInDto,
    @Req() req: Request,
  ): Promise<GoogleSignInResponse> {
    return this.authService.signInWithGoogle(dto, {
      ip: req.ip ?? null,
      userAgent: readUserAgent(req),
    });
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

function readUserAgent(req: Request): string | null {
  const header = req.headers["user-agent"];
  if (header === undefined) return null;
  return Array.isArray(header) ? header.join(", ") : header;
}
