import { cookies } from "next/headers";
import {
  createGoogleSession,
  deleteCurrentSession,
  deleteMe,
  deleteSession,
  getMe,
  getSessions,
} from "../api-client";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

const cookiesMock = cookies as jest.MockedFunction<typeof cookies>;

/**
 * Build a stub for the `next/headers` cookies() store. Its return
 * (`ReadonlyRequestCookies`) has too many methods to satisfy structurally —
 * the single cast here is the only place tests fabricate that shape.
 */
function fakeCookieStore(
  set: jest.Mock = jest.fn(),
): Awaited<ReturnType<typeof cookies>> {
  return { set } as unknown as Awaited<ReturnType<typeof cookies>>;
}

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_API_BASE_URL = process.env.API_BASE_URL;

beforeEach(() => {
  process.env.API_BASE_URL = "http://api.test";
  // Default: a writeable cookie store that records nothing. Tests that care
  // about cookie refresh override this with their own jar.
  cookiesMock.mockResolvedValue(fakeCookieStore());
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  cookiesMock.mockReset();
  if (ORIGINAL_API_BASE_URL === undefined) {
    delete process.env.API_BASE_URL;
  } else {
    process.env.API_BASE_URL = ORIGINAL_API_BASE_URL;
  }
});

function mockFetch(response: {
  ok: boolean;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const fn = jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
    headers: new Headers(response.headers ?? {}),
  });
  global.fetch = fn as unknown as typeof global.fetch;
  return fn;
}

describe("getMe", () => {
  it("returns null when no session cookie is provided", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 200, body: null });

    expect(await getMe(undefined)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the parsed body on success", async () => {
    const me = {
      id: "u1",
      name: "U",
      email: "u@example.com",
      avatarUrl: null,
    };
    mockFetch({ ok: true, status: 200, body: me });

    expect(await getMe("session-cookie")).toEqual(me);
  });

  it("returns null on 401 or 404", async () => {
    mockFetch({ ok: false, status: 401 });
    expect(await getMe("session-cookie")).toBeNull();

    mockFetch({ ok: false, status: 404 });
    expect(await getMe("session-cookie")).toBeNull();
  });

  it("throws on other non-2xx statuses", async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(getMe("session-cookie")).rejects.toThrow(
      "/users/me GET failed with status 500",
    );
  });
});

describe("getSessions", () => {
  it("returns null when no session cookie is provided", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 200, body: [] });

    expect(await getSessions(undefined)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the parsed JSON body on success", async () => {
    const items = [
      {
        id: "s1",
        deviceLabel: "Chrome on macOS",
        lastActiveAt: "2026-05-23T00:00:00.000Z",
        isCurrent: true,
      },
    ];
    const fetchSpy = mockFetch({ ok: true, status: 200, body: items });

    expect(await getSessions("session-cookie")).toEqual(items);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://api.test/users/me/sessions",
      expect.objectContaining({
        headers: { Cookie: "fortuna_session=session-cookie" },
        cache: "no-store",
      }),
    );
  });

  it("returns null when the API returns 401", async () => {
    mockFetch({ ok: false, status: 401 });
    expect(await getSessions("session-cookie")).toBeNull();
  });

  it("throws on other non-2xx status codes", async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(getSessions("session-cookie")).rejects.toThrow(
      "/users/me/sessions GET failed with status 500",
    );
  });
});

describe("deleteCurrentSession", () => {
  it("is a no-op when no session cookie is provided", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 204 });

    await deleteCurrentSession(undefined);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("DELETEs /auth/session with the session cookie", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 204 });

    await deleteCurrentSession("session-cookie");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://api.test/auth/session",
      expect.objectContaining({
        method: "DELETE",
        headers: { Cookie: "fortuna_session=session-cookie" },
      }),
    );
  });

  it("tolerates 401 (session already invalid)", async () => {
    mockFetch({ ok: false, status: 401 });
    await expect(deleteCurrentSession("c")).resolves.toBeUndefined();
  });

  it("throws on other non-2xx status codes", async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(deleteCurrentSession("c")).rejects.toThrow(
      "/auth/session DELETE failed with status 500",
    );
  });
});

describe("createGoogleSession", () => {
  it("forwards the browser's user-agent so the session row carries a real device label", async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 201,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
    });

    const browserUa =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    await createGoogleSession("id.token", "nonce-123", {
      userAgent: browserUa,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(init.headers["User-Agent"]).toBe(browserUa);
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      idToken: "id.token",
      nonce: "nonce-123",
    });
  });

  it("omits User-Agent when none is provided", async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 201,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
    });

    await createGoogleSession("id.token", "nonce-123");

    const [, init] = fetchSpy.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers["User-Agent"]).toBeUndefined();
  });

  it("forwards the device_id cookie value so the API can compute the fingerprint", async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 201,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
    });

    await createGoogleSession("id.token", "nonce-123", {
      deviceId: "device-cookie-value",
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      idToken: "id.token",
      nonce: "nonce-123",
      deviceId: "device-cookie-value",
    });
  });

  it("omits deviceId from the body when none is provided", async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 201,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
    });

    await createGoogleSession("id.token", "nonce-123");

    const [, init] = fetchSpy.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      idToken: "id.token",
      nonce: "nonce-123",
    });
  });

  it("throws on non-2xx statuses", async () => {
    mockFetch({ ok: false, status: 401 });
    await expect(createGoogleSession("t", "n")).rejects.toThrow(
      "/auth/google POST failed with status 401",
    );
  });
});

describe("deleteMe", () => {
  it("DELETEs /users/me with confirm:true in the body and the session cookie", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 204 });

    await deleteMe("session-cookie");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://api.test/users/me",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Cookie: "fortuna_session=session-cookie",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ confirm: true }),
      }),
    );
  });

  it("throws on non-2xx status codes", async () => {
    mockFetch({ ok: false, status: 400 });
    await expect(deleteMe("c")).rejects.toThrow(
      "/users/me DELETE failed with status 400",
    );
  });
});

describe("session cookie refresh on slide", () => {
  function mockCookieStore(): { set: jest.Mock } {
    const set = jest.fn();
    cookiesMock.mockResolvedValue(fakeCookieStore(set));
    return { set };
  }

  it("re-issues the session cookie when the API returns X-Session-Expires-At", async () => {
    const store = mockCookieStore();
    const newExpiry = "2026-12-31T00:00:00.000Z";
    mockFetch({
      ok: true,
      status: 200,
      body: { id: "u1", name: "U", email: "u@example.com", avatarUrl: null },
      headers: { "X-Session-Expires-At": newExpiry },
    });

    await getMe("session-cookie");

    expect(store.set).toHaveBeenCalledWith(
      "fortuna_session",
      "session-cookie",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(newExpiry),
      }),
    );
  });

  it("does not touch cookies when the API omits the header", async () => {
    const store = mockCookieStore();
    mockFetch({
      ok: true,
      status: 200,
      body: { id: "u1", name: "U", email: "u@example.com", avatarUrl: null },
    });

    await getMe("session-cookie");

    expect(store.set).not.toHaveBeenCalled();
  });

  it("swallows cookies().set throws (Server Component read-only context)", async () => {
    cookiesMock.mockResolvedValue(
      fakeCookieStore(
        jest.fn(() => {
          throw new Error("Cookies can only be modified in a Server Action");
        }),
      ),
    );
    mockFetch({
      ok: true,
      status: 200,
      body: { id: "u1", name: "U", email: "u@example.com", avatarUrl: null },
      headers: { "X-Session-Expires-At": "2026-12-31T00:00:00.000Z" },
    });

    await expect(getMe("session-cookie")).resolves.not.toBeNull();
  });

  it("does not refresh when no session cookie was forwarded", async () => {
    const store = mockCookieStore();
    mockFetch({
      ok: true,
      status: 200,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
      headers: { "X-Session-Expires-At": "2026-12-31T00:00:00.000Z" },
    });

    await createGoogleSession("id.token", "nonce");

    expect(store.set).not.toHaveBeenCalled();
  });

  it("ignores a malformed expiry header rather than corrupting the cookie", async () => {
    const store = mockCookieStore();
    mockFetch({
      ok: true,
      status: 200,
      body: { id: "u1", name: "U", email: "u@example.com", avatarUrl: null },
      headers: { "X-Session-Expires-At": "not-a-date" },
    });

    await getMe("session-cookie");

    expect(store.set).not.toHaveBeenCalled();
  });
});

describe("deleteSession (revoke other)", () => {
  it("DELETEs /users/me/sessions/:id with the session cookie", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 204 });

    await deleteSession("session-cookie", "session-other-id");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://api.test/users/me/sessions/session-other-id",
      expect.objectContaining({
        method: "DELETE",
        headers: { Cookie: "fortuna_session=session-cookie" },
      }),
    );
  });

  it("URL-encodes the session id", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 204 });

    await deleteSession("c", "id with/slash");

    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe("http://api.test/users/me/sessions/id%20with%2Fslash");
  });

  it("throws on non-2xx status codes", async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(deleteSession("c", "s")).rejects.toThrow(
      "/users/me/sessions/s DELETE failed with status 404",
    );
  });
});
