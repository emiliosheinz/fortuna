import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  readSessionCookie,
  SESSION_EXPIRES_AT_HEADER,
} from "../cookies/session-cookie";
import { SessionsService } from "../services/sessions.service";

/** Authenticated principal attached to the request by {@link SessionGuard}. */
export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
}

/**
 * Shape of a request after a successful pass through {@link SessionGuard}.
 * Downstream handlers should read `request.principal.userId` rather than any
 * client-supplied identity hint.
 */
export interface RequestWithPrincipal {
  principal?: AuthenticatedPrincipal;
  headers: Record<string, string | string[] | undefined>;
}

/** Minimal structural shape of the response object the guard needs. */
interface ResponseWithSetHeader {
  setHeader(name: string, value: string): unknown;
}

/**
 * Guard for every user-scoped endpoint.
 *
 * Reads the session cookie, looks the row up by its SHA-256 hash, rejects
 * with a bare 401 (no internal detail) on missing/revoked/expired, slides the
 * session's idle window when stale, then attaches the principal to the
 * request.
 *
 * Sets `X-Session-Expires-At` on the response so apps/web can re-issue the
 * browser cookie with the slid expiry — without it, the cookie would expire
 * 30 days after the initial sign-in regardless of activity.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithPrincipal>();

    const cookieHeader = normalizeCookieHeader(request.headers.cookie);
    const rawToken = readSessionCookie(cookieHeader);
    if (!rawToken) throw new UnauthorizedException();

    const session = await this.sessions.findActiveByRawToken(rawToken);
    if (!session) throw new UnauthorizedException();

    await this.sessions.maybeSlide(session);

    const response = http.getResponse<ResponseWithSetHeader>();
    response.setHeader(
      SESSION_EXPIRES_AT_HEADER,
      session.expiresAt.toISOString(),
    );

    request.principal = {
      userId: session.userId,
      sessionId: session.id,
    };
    return true;
  }
}

function normalizeCookieHeader(
  header: string | string[] | undefined,
): string | undefined {
  if (header === undefined) return undefined;
  return Array.isArray(header) ? header.join("; ") : header;
}
