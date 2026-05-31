/**
 * @jest-environment node
 */

import { createGoogleSession } from "../api-client";

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

function mockFetch(response: {
  ok: boolean;
  status: number;
  body?: unknown;
}): jest.Mock {
  const fn = jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  });
  global.fetch = fn as unknown as typeof global.fetch;
  return fn;
}

describe("createGoogleSession", () => {
  it("POSTs the ID token + nonce and returns the session payload", async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 201,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
    });

    const result = await createGoogleSession("id.token", "nonce-123");

    expect(result).toEqual({
      sessionToken: "tok",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://api.test/auth/google",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ idToken: "id.token", nonce: "nonce-123" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("forwards the browser's user-agent so the session row carries a real device label", async () => {
    const fetchSpy = mockFetch({
      ok: true,
      status: 201,
      body: { sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z" },
    });

    const browserUa =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
    await createGoogleSession("id.token", "nonce-123", {
      userAgent: browserUa,
    });

    const [, init] = fetchSpy.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers["User-Agent"]).toBe(browserUa);
  });

  it("forwards the device_id cookie value for the per-user device fingerprint", async () => {
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

  it("throws on non-2xx statuses", async () => {
    mockFetch({ ok: false, status: 401 });
    await expect(createGoogleSession("t", "n")).rejects.toThrow(
      "/auth/google POST failed with status 401",
    );
  });
});
