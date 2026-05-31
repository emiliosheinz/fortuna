/**
 * @jest-environment node
 */

import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie-names";
import { GET } from "../route";

describe("GET /api/auth/clear-session", () => {
  it("issues a 307 with a relative Location to /auth/sign-in", () => {
    const res = GET();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/auth/sign-in");
  });

  it("expires the session cookie on the response", () => {
    const res = GET();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toMatch(
      /max-age=0|expires=thu, 01 jan 1970/,
    );
  });
});
