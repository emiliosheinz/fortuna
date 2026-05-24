import {
  deleteAccount,
  deleteCurrentSession,
  deleteSession,
  listSessions,
  postGoogleIdToken,
} from "../api-client";

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_API_BASE_URL = process.env.API_BASE_URL;

beforeEach(() => {
  process.env.API_BASE_URL = "http://api.test";
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_API_BASE_URL === undefined) {
    delete process.env.API_BASE_URL;
  } else {
    process.env.API_BASE_URL = ORIGINAL_API_BASE_URL;
  }
});

function mockFetch(response: { ok: boolean; status: number; body?: unknown }) {
  const fn = jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  });
  global.fetch = fn as unknown as typeof global.fetch;
  return fn;
}

describe("listSessions", () => {
  it("returns null when no session cookie is provided", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 200, body: [] });

    const result = await listSessions(undefined);

    expect(result).toBeNull();
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

    const result = await listSessions("session-cookie");

    expect(result).toEqual(items);
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

    expect(await listSessions("session-cookie")).toBeNull();
  });

  it("throws on other non-2xx status codes", async () => {
    mockFetch({ ok: false, status: 500 });

    await expect(listSessions("session-cookie")).rejects.toThrow(
      "/users/me/sessions failed with status 500",
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

describe("postGoogleIdToken", () => {
  it("forwards the browser's user-agent so the session row carries a real device label", async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 201,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
    });

    const browserUa =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    await postGoogleIdToken("id.token", "nonce-123", { userAgent: browserUa });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers["User-Agent"]).toBe(browserUa);
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("omits User-Agent when none is provided", async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 201,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
    });

    await postGoogleIdToken("id.token", "nonce-123");

    const [, init] = fetchSpy.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers["User-Agent"]).toBeUndefined();
  });
});

describe("deleteAccount", () => {
  it("DELETEs /users/me with confirm:true in the body and the session cookie", async () => {
    const fetchSpy = mockFetch({ ok: true, status: 204 });

    await deleteAccount("session-cookie");

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
    await expect(deleteAccount("c")).rejects.toThrow(
      "/users/me DELETE failed with status 400",
    );
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
