import { readSessionCookie, SESSION_COOKIE_NAME } from "./session-cookie";

describe("readSessionCookie", () => {
  it("returns null when no Cookie header", () => {
    expect(readSessionCookie(undefined)).toBeNull();
  });

  it("returns null when cookie name absent", () => {
    expect(readSessionCookie("other=foo; another=bar")).toBeNull();
  });

  it("extracts the session value when present", () => {
    const header = `other=foo; ${SESSION_COOKIE_NAME}=opaque-123; trailing=x`;
    expect(readSessionCookie(header)).toBe("opaque-123");
  });

  it("URL-decodes the value", () => {
    const header = `${SESSION_COOKIE_NAME}=a%20b%2Fc`;
    expect(readSessionCookie(header)).toBe("a b/c");
  });
});
