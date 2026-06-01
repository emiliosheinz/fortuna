import { navigateTo } from "./navigate";

/**
 * Path of the route handler that drops the session cookie and bounces the
 * user back to `/auth/sign-in`. Exported so tests can assert against it
 * without hard-coding the string.
 */
export const CLEAR_SESSION_PATH = "/api/auth/clear-session";

/**
 * Error thrown when the API responds with a non-success status. Carries the
 * HTTP status so callers (e.g. TanStack `onError`) can branch on it without
 * parsing the message.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  signal?: AbortSignal;
}

interface JsonBodyOptions extends RequestOptions {
  body: unknown;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: RequestOptions & { body?: unknown } = {},
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    signal: options.signal,
  };

  if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, init);

  if (response.status === 401) {
    // Session cookie is missing, malformed, expired, or revoked. The
    // cookie is HttpOnly so we can't drop it from JS — hand off to the
    // route handler that can, which also redirects to /auth/sign-in.
    navigateTo(CLEAR_SESSION_PATH);
    throw new ApiError(401, "Unauthorized — navigating to clear-session");
  }

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return undefined as T;
}

/**
 * Browser-side wrapper around `fetch` for talking to the backend via the
 * `/api/v1/*` namespace (proxied to `API_BASE_URL` by `middleware.ts`).
 * Every authenticated query and mutation in the app goes through this
 * client.
 *
 * - Always uses `credentials: "same-origin"` so the HttpOnly session cookie
 *   is sent with the request.
 * - On `401`, navigates to `/api/auth/clear-session`, which drops the
 *   cookie and redirects to `/auth/sign-in`. The promise rejects with an
 *   `ApiError`, so TanStack treats the query/mutation as errored.
 * - On other non-2xx statuses, rejects with an `ApiError` carrying the
 *   HTTP status; the caller decides how to surface it.
 */
export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, options);
  },
  post<T>(path: string, options: JsonBodyOptions): Promise<T> {
    return request<T>("POST", path, options);
  },
  patch<T>(path: string, options: JsonBodyOptions): Promise<T> {
    return request<T>("PATCH", path, options);
  },
  put<T>(path: string, options: JsonBodyOptions): Promise<T> {
    return request<T>("PUT", path, options);
  },
  delete<T = void>(
    path: string,
    options?: RequestOptions & { body?: unknown },
  ): Promise<T> {
    return request<T>("DELETE", path, options);
  },
};
