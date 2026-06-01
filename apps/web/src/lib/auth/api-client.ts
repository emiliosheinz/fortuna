import { requireEnv } from "./env";

/** Shape of the API's `POST /auth/google` response. */
export interface GoogleSignInResponse {
  sessionToken: string;
  expiresAt: string;
}

/**
 * Forward a Google ID token + nonce to the API so it can verify the token,
 * upsert the user, and mint a session. `apps/web` takes the returned
 * `sessionToken` and sets it as the session cookie itself.
 *
 * `userAgent` should be the browser's UA from the inbound request — the API
 * persists it on the session row and derives the device label from it. If
 * omitted, the session inherits Node's default fetch UA and renders as
 * "Unknown device".
 *
 * `deviceId` carries the raw long-lived device cookie value forward to the
 * API so it can compute the per-user device fingerprint. Omit when no
 * cookie was present on the inbound request; the API will treat it as a
 * brand-new device.
 *
 * Runs server-side from the OAuth callback handler — this is the only
 * web-side path that talks to `apps/api` directly, because the response
 * carries a session token that the route handler must set as an HttpOnly
 * cookie. Every other API call goes through the `/api/v1/*` namespace
 * (proxied by `middleware.ts`) from the browser and uses
 * `lib/api-client.ts`.
 */
export async function createGoogleSession(
  idToken: string,
  nonce: string,
  opts: { userAgent?: string; deviceId?: string } = {},
): Promise<GoogleSignInResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.userAgent) headers["User-Agent"] = opts.userAgent;

  const body: { idToken: string; nonce: string; deviceId?: string } = {
    idToken,
    nonce,
  };
  if (opts.deviceId) body.deviceId = opts.deviceId;

  const apiBaseUrl = requireEnv("API_BASE_URL");
  const response = await fetch(`${apiBaseUrl}/auth/google`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`/auth/google POST failed with status ${response.status}`);
  }

  return (await response.json()) as GoogleSignInResponse;
}
