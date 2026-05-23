import {
  parse as parseCookieHeader,
  serialize as serializeCookie,
} from "cookie";

/** Name of the opaque session cookie set by apps/web after sign-in. */
export const SESSION_COOKIE_NAME = "fortuna_session";

/** Rolling lifetime of a session cookie, in milliseconds. */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Serialize a `Set-Cookie` value that clears the session cookie.
 *
 * Mirrors the attributes apps/web sets when minting the cookie (host-only,
 * `Path=/`, `HttpOnly`, `SameSite=Lax`, `Secure` only in production) — the
 * browser will only honor the clear if those match.
 */
export function buildClearSessionCookieHeader(): string {
  return serializeCookie(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Extract the raw session token from a request's `Cookie` header.
 *
 * Returns null when the header is absent or the session cookie has no value.
 * Centralizes the cookie name and parsing so the guard never reads
 * `request.headers.cookie` directly.
 */
export function readSessionCookie(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) return null;
  const value = parseCookieHeader(cookieHeader)[SESSION_COOKIE_NAME];
  return value && value.length > 0 ? value : null;
}
