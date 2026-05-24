import { SESSION_COOKIE_NAME } from "./cookies";
import { requireEnv } from "./env";

/** Shape of the API's `GET /users/me` response. */
export interface MeResponse {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/** Shape of a single item in `GET /users/me/sessions`. */
export interface SessionListItem {
  id: string;
  deviceLabel: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

/** Shape of the API's `POST /auth/google` response. */
export interface GoogleSignInResponse {
  sessionToken: string;
  expiresAt: string;
}

interface ApiFetchOptions {
  /** HTTP method. Defaults to `"GET"`. */
  method?: "GET" | "POST" | "DELETE";
  /** Optional session cookie value to forward to the API. */
  sessionCookie?: string;
  /** Request body — JSON-serialized; the helper sets Content-Type. */
  body?: unknown;
  /** Extra headers merged on top of the defaults. */
  headers?: Record<string, string>;
  /** HTTP statuses to treat as "not found / unauthenticated, return null". */
  treatAsNull?: number[];
}

interface ApiFetchResult {
  /** Raw Response — caller chooses how to read it (json / text / nothing). */
  response: Response;
  /** True iff the status matched one of `treatAsNull`. */
  isNullStatus: boolean;
}

/**
 * Thin wrapper over `fetch` that injects the API base URL, forwards the
 * session cookie, serializes JSON bodies, and converts non-2xx responses into
 * thrown errors — except for caller-listed statuses (typically 401 / 404)
 * which surface as `isNullStatus: true` so route handlers can redirect to a
 * public surface instead of error-boundary-ing.
 *
 * Every endpoint in this file goes through here; the function-per-endpoint
 * exports below stay short and uniform.
 */
async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<ApiFetchResult> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.sessionCookie) {
    headers.Cookie = `${SESSION_COOKIE_NAME}=${options.sessionCookie}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    cache: "no-store",
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const apiBaseUrl = requireEnv("API_BASE_URL");
  const response = await fetch(`${apiBaseUrl}${path}`, init);

  if (options.treatAsNull?.includes(response.status)) {
    return { response, isNullStatus: true };
  }
  if (!response.ok) {
    throw new Error(
      `${path} ${init.method} failed with status ${response.status}`,
    );
  }
  return { response, isNullStatus: false };
}

/**
 * Server-side fetch of the authenticated user's profile.
 *
 * Returns null when there's no session cookie or the API rejects with
 * 401/404 (so callers can redirect to the landing page without throwing).
 */
export async function getMe(
  sessionCookie: string | undefined,
): Promise<MeResponse | null> {
  if (!sessionCookie) return null;
  const { response, isNullStatus } = await apiFetch("/users/me", {
    sessionCookie,
    treatAsNull: [401, 404],
  });
  if (isNullStatus) return null;
  return (await response.json()) as MeResponse;
}

/**
 * Server-side fetch of the user's active sessions.
 *
 * Returns null when there's no session cookie or the API rejects with 401.
 */
export async function getSessions(
  sessionCookie: string | undefined,
): Promise<SessionListItem[] | null> {
  if (!sessionCookie) return null;
  const { response, isNullStatus } = await apiFetch("/users/me/sessions", {
    sessionCookie,
    treatAsNull: [401],
  });
  if (isNullStatus) return null;
  return (await response.json()) as SessionListItem[];
}

/**
 * Sign out the current device by revoking the session server-side. Tolerates
 * a missing session cookie — the caller still wants to land on the public
 * surface. A 401 means the session was already invalid, which is the desired
 * end state anyway.
 */
export async function deleteCurrentSession(
  sessionCookie: string | undefined,
): Promise<void> {
  if (!sessionCookie) return;
  await apiFetch("/auth/session", {
    method: "DELETE",
    sessionCookie,
    treatAsNull: [401],
  });
}

/** Revoke one of the user's non-current sessions by id. */
export async function deleteSession(
  sessionCookie: string,
  sessionId: string,
): Promise<void> {
  await apiFetch(`/users/me/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    sessionCookie,
  });
}

/**
 * Hard-delete the signed-in user's account.
 *
 * Forwards `{ confirm: true }`; the API anonymizes sign-in events and
 * cascades sessions + identities. Caller is responsible for clearing the
 * session cookie after a successful 204 — the API also sends a clear-cookie
 * header, but the server-action layer overwrites the cookie jar separately
 * to keep behavior deterministic.
 */
export async function deleteMe(sessionCookie: string): Promise<void> {
  await apiFetch("/users/me", {
    method: "DELETE",
    sessionCookie,
    body: { confirm: true },
  });
}

/**
 * Forward a Google ID token + nonce to the API so it can verify the token,
 * upsert the user, and mint a session. apps/web takes the returned
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
 */
export async function createGoogleSession(
  idToken: string,
  nonce: string,
  opts: { userAgent?: string; deviceId?: string } = {},
): Promise<GoogleSignInResponse> {
  const headers: Record<string, string> = {};
  if (opts.userAgent) headers["User-Agent"] = opts.userAgent;

  const body: { idToken: string; nonce: string; deviceId?: string } = {
    idToken,
    nonce,
  };
  if (opts.deviceId) body.deviceId = opts.deviceId;

  const { response } = await apiFetch("/auth/google", {
    method: "POST",
    headers,
    body,
  });
  return (await response.json()) as GoogleSignInResponse;
}
