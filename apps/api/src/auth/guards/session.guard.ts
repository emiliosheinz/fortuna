import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { readSessionCookie } from "../cookies/session-cookie";
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

/**
 * Guard for every user-scoped endpoint.
 *
 * Reads the session cookie, looks the row up by its SHA-256 hash, rejects
 * with a bare 401 (no internal detail) on missing/revoked/expired, slides the
 * session's idle window when stale, then attaches the principal to the
 * request.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    const cookieHeader = normalizeCookieHeader(request.headers.cookie);
    const rawToken = readSessionCookie(cookieHeader);
    if (!rawToken) throw new UnauthorizedException();

    const session = await this.sessions.findActiveByRawToken(rawToken);
    if (!session) throw new UnauthorizedException();

    await this.sessions.maybeSlide(session);

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
