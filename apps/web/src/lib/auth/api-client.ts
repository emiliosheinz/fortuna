import { SESSION_COOKIE_NAME } from "./cookies";
import { requireEnv } from "./oidc";

/** Shape of the API's `GET /users/me` response. */
export interface MeResponse {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * Server-side fetch of the authenticated user's profile from the API.
 *
 * Returns null when there's no session cookie or the API rejects with
 * 401/404 (so callers can redirect to the landing page without throwing).
 * Any other non-2xx status surfaces as an error.
 */
export async function fetchMe(
  sessionCookieValue: string | undefined,
): Promise<MeResponse | null> {
  if (!sessionCookieValue) return null;

  const apiBaseUrl = requireEnv("API_BASE_URL");
  const res = await fetch(`${apiBaseUrl}/users/me`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${sessionCookieValue}`,
    },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`/users/me failed with status ${res.status}`);
  }
  return (await res.json()) as MeResponse;
}

/** Shape of the API's `POST /auth/google` response. */
export interface GoogleSignInResponse {
  sessionToken: string;
  expiresAt: string;
}

/**
 * Forward a Google ID token + nonce to the API so it can verify the token,
 * upsert the user, and mint a session. apps/web takes the returned
 * `sessionToken` and sets it as the session cookie itself.
 */
export async function postGoogleIdToken(
  idToken: string,
  nonce: string,
): Promise<GoogleSignInResponse> {
  const apiBaseUrl = requireEnv("API_BASE_URL");
  const res = await fetch(`${apiBaseUrl}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, nonce }),
  });
  if (!res.ok) {
    throw new Error(`/auth/google failed with status ${res.status}`);
  }
  return (await res.json()) as GoogleSignInResponse;
}
