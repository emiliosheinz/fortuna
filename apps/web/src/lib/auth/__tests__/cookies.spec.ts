import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import {
  DEVICE_ID_COOKIE_MAX_AGE_S,
  DEVICE_ID_COOKIE_NAME,
  mintDeviceId,
  setDeviceIdCookie,
} from "../cookies";

type CookieSetCall = Parameters<ResponseCookies["set"]>;

function buildCookieJar(): {
  cookies: ResponseCookies;
  calls: CookieSetCall[];
} {
  const calls: CookieSetCall[] = [];
  const cookies = {
    set: jest.fn((...args: CookieSetCall) => {
      calls.push(args);
      return cookies;
    }),
  } as unknown as ResponseCookies;
  return { cookies, calls };
}

describe("mintDeviceId", () => {
  it("returns a non-empty opaque value", () => {
    const id = mintDeviceId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThanOrEqual(32);
  });

  it("returns a different value each call (CSPRNG)", () => {
    expect(mintDeviceId()).not.toBe(mintDeviceId());
  });

  it("emits a base64url-safe string", () => {
    expect(mintDeviceId()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("setDeviceIdCookie", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: ORIGINAL_NODE_ENV,
      configurable: true,
    });
  });

  it("sets the cookie with the design-mandated attributes (HttpOnly, SameSite=Lax, host-only, Path=/, two-year max-age)", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
    });
    const { cookies, calls } = buildCookieJar();

    setDeviceIdCookie(cookies, "device-value");

    expect(calls).toHaveLength(1);
    const [name, value, options] = calls[0];
    expect(name).toBe(DEVICE_ID_COOKIE_NAME);
    expect(value).toBe("device-value");
    expect(options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_ID_COOKIE_MAX_AGE_S,
    });
    expect(DEVICE_ID_COOKIE_MAX_AGE_S).toBe(2 * 365 * 24 * 60 * 60);
  });

  it("drops Secure in non-production so localhost dev still works", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
    const { cookies, calls } = buildCookieJar();

    setDeviceIdCookie(cookies, "device-value");

    const [, , options] = calls[0];
    expect(options).toEqual(
      expect.objectContaining({ secure: false, sameSite: "lax" }),
    );
  });
});
