import { parse as parseCookieHeader } from "cookie";

/** Name of the opaque session cookie set by apps/web after sign-in. */
export const SESSION_COOKIE_NAME = "fortuna_session";

/** Rolling lifetime of a session cookie, in milliseconds. */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

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
