import { randomBytes } from "node:crypto";
import {
  DEVICE_ID_COOKIE_NAME,
  OAUTH_NONCE_COOKIE,
  OAUTH_PKCE_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE_NAME,
} from "./cookie-names";

export {
  DEVICE_ID_COOKIE_NAME,
  OAUTH_NONCE_COOKIE,
  OAUTH_PKCE_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE_NAME,
};
/** Two years — matches the design's intent that fingerprints survive
 * long enough to avoid email-spamming users on every browser refresh. */
export const DEVICE_ID_COOKIE_MAX_AGE_S = 2 * 365 * 24 * 60 * 60;
const DEVICE_ID_BYTES = 32;

/** Max-Age (seconds) of the OAuth temp cookies — long enough to cover the
 * Google redirect, short enough to limit replay. */
export const OAUTH_TEMP_COOKIE_MAX_AGE_S = 5 * 60;
const OAUTH_CALLBACK_PATH = "/api/auth/callback/google";

/**
 * Minimal structural type for a writeable cookie jar. Satisfied by both
 * `NextResponse.cookies` (used by route handlers) and the store returned by
 * `cookies()` from `next/headers` (used by server actions). Keeps the
 * callsites loose and lets unit tests inject a typed stub without `as
 * unknown as` casts.
 */
export interface CookieJar {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none" | boolean;
      path?: string;
      expires?: Date;
      maxAge?: number;
      domain?: string;
    },
  ): unknown;
}

/**
 * Set the session cookie with the design-mandated attributes
 * (HttpOnly, Secure when in production, SameSite=Lax, host-only, Path=/).
 *
 * `expires` is authoritative: it mirrors the server-side `expires_at` and is
 * re-issued on every authenticated response (see `apiFetch` in
 * `./api-client.ts`) so the browser's expiry tracks the rolling DB window.
 */
export function setSessionCookie(
  cookies: CookieJar,
  sessionToken: string,
  expiresAt: Date,
): void {
  cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Generate a fresh opaque `device_id` cookie value. 32 bytes of CSPRNG
 * entropy, base64url-encoded — the raw value never reaches the API; only
 * its SHA-256 hash via `fingerprint_hash`.
 */
export function mintDeviceId(): string {
  return randomBytes(DEVICE_ID_BYTES).toString("base64url");
}

/**
 * Set the long-lived `device_id` cookie. Mirrors the session cookie's
 * security posture (HttpOnly, Secure in prod, SameSite=Lax, host-only,
 * Path=/) with a two-year expiry per the design.
 */
export function setDeviceIdCookie(cookies: CookieJar, deviceId: string): void {
  cookies.set(DEVICE_ID_COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_ID_COOKIE_MAX_AGE_S,
  });
}

/** Expire the session cookie on the response (used on sign-out / deletion). */
export function clearSessionCookie(cookies: CookieJar): void {
  cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
  });
}

export interface TempCookieValues {
  state: string;
  codeVerifier: string;
  nonce: string;
}

/**
 * Stash `state`, PKCE `codeVerifier`, and `nonce` in HttpOnly cookies scoped
 * to the OAuth callback path. Read once by the callback handler and cleared.
 */
export function setOauthTempCookies(
  cookies: CookieJar,
  values: TempCookieValues,
): void {
  const base = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: OAUTH_CALLBACK_PATH,
    maxAge: OAUTH_TEMP_COOKIE_MAX_AGE_S,
  };
  cookies.set(OAUTH_STATE_COOKIE, values.state, base);
  cookies.set(OAUTH_PKCE_COOKIE, values.codeVerifier, base);
  cookies.set(OAUTH_NONCE_COOKIE, values.nonce, base);
}

/** Expire all three OAuth temp cookies. */
export function clearOauthTempCookies(cookies: CookieJar): void {
  const base = {
    path: OAUTH_CALLBACK_PATH,
    maxAge: 0,
  };
  cookies.set(OAUTH_STATE_COOKIE, "", base);
  cookies.set(OAUTH_PKCE_COOKIE, "", base);
  cookies.set(OAUTH_NONCE_COOKIE, "", base);
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
