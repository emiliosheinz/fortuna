import { randomBytes } from "node:crypto";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

/** Name of the session cookie set after successful sign-in. */
export const SESSION_COOKIE_NAME = "fortuna_session";
/** Rolling lifetime of the session cookie, in seconds. */
export const SESSION_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

/** Short-lived cookies carrying OAuth state, PKCE verifier, and nonce. */
export const OAUTH_STATE_COOKIE = "fortuna_oauth_state";
export const OAUTH_PKCE_COOKIE = "fortuna_oauth_pkce";
export const OAUTH_NONCE_COOKIE = "fortuna_oauth_nonce";

/**
 * Long-lived cookie carrying an opaque per-browser identifier. Combined
 * server-side with the UA family to derive the device fingerprint hash.
 */
export const DEVICE_ID_COOKIE_NAME = "fortuna_device_id";
/** Two years — matches the design's intent that fingerprints survive
 * long enough to avoid email-spamming users on every browser refresh. */
export const DEVICE_ID_COOKIE_MAX_AGE_S = 2 * 365 * 24 * 60 * 60;
const DEVICE_ID_BYTES = 32;

/** Max-Age (seconds) of the OAuth temp cookies — long enough to cover the
 * Google redirect, short enough to limit replay. */
export const OAUTH_TEMP_COOKIE_MAX_AGE_S = 5 * 60;
const OAUTH_CALLBACK_PATH = "/api/auth/callback/google";

/**
 * Set the session cookie with the design-mandated attributes
 * (HttpOnly, Secure when in production, SameSite=Lax, host-only, Path=/).
 *
 * apps/api returns the opaque token via JSON; apps/web is responsible for
 * placing it into the cookie jar with the correct security posture.
 */
export function setSessionCookie(
  cookies: ResponseCookies,
  sessionToken: string,
  expiresAt: Date,
): void {
  cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_COOKIE_MAX_AGE_S,
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
export function setDeviceIdCookie(
  cookies: ResponseCookies,
  deviceId: string,
): void {
  cookies.set(DEVICE_ID_COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_ID_COOKIE_MAX_AGE_S,
  });
}

/** Expire the session cookie on the response (used on sign-out / deletion). */
export function clearSessionCookie(cookies: ResponseCookies): void {
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
  cookies: ResponseCookies,
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
export function clearOauthTempCookies(cookies: ResponseCookies): void {
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
