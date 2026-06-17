/**
 * @jest-environment node
 */

import type { NextRequest } from "next/server";
import { authorizationCodeGrant } from "openid-client";
import { createGoogleSession } from "@/lib/auth/api-client";
import {
  DEVICE_ID_COOKIE_NAME,
  OAUTH_NONCE_COOKIE,
  OAUTH_PKCE_COOKIE,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth/cookies";
import { getOidcConfig, getRedirectUri } from "@/lib/auth/oidc";
import { GET } from "../route";

jest.mock("openid-client", () => ({
  authorizationCodeGrant: jest.fn(),
}));
jest.mock("@/lib/auth/oidc", () => ({
  getOidcConfig: jest.fn(),
  getRedirectUri: jest.fn(),
}));
jest.mock("@/lib/auth/api-client", () => ({
  createGoogleSession: jest.fn(),
}));

const authorizationCodeGrantMock =
  authorizationCodeGrant as jest.MockedFunction<typeof authorizationCodeGrant>;
const getOidcConfigMock = getOidcConfig as jest.MockedFunction<
  typeof getOidcConfig
>;
const getRedirectUriMock = getRedirectUri as jest.MockedFunction<
  typeof getRedirectUri
>;
const createGoogleSessionMock = createGoogleSession as jest.MockedFunction<
  typeof createGoogleSession
>;

function mockRequest(url: string): NextRequest {
  const cookieStore = new Map<string, string>([
    [OAUTH_STATE_COOKIE, "state-from-cookie"],
    [OAUTH_PKCE_COOKIE, "code-verifier-from-cookie"],
    [OAUTH_NONCE_COOKIE, "nonce-from-cookie"],
    [DEVICE_ID_COOKIE_NAME, "existing-device"],
  ]);
  return {
    url,
    cookies: { get: (name: string) => ({ value: cookieStore.get(name) }) },
    headers: { get: () => null },
  } as unknown as NextRequest;
}

describe("GET /api/auth/callback/google", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOidcConfigMock.mockResolvedValue({} as never);
    getRedirectUriMock.mockReturnValue(
      "https://fortuna.emiliosheinz.com/api/auth/callback/google",
    );
    authorizationCodeGrantMock.mockResolvedValue({
      id_token: "fake-id-token",
    } as never);
    createGoogleSessionMock.mockResolvedValue({
      sessionToken: "session-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });

  it("sends the token exchange with the configured redirect_uri scheme + host, regardless of req.url", async () => {
    const req = mockRequest(
      "http://web:3001/api/auth/callback/google?code=auth-code&state=state-from-cookie",
    );

    await GET(req);

    expect(authorizationCodeGrantMock).toHaveBeenCalledTimes(1);
    const [, calledUrl] = authorizationCodeGrantMock.mock.calls[0];
    expect(calledUrl).toBeInstanceOf(URL);
    const url = calledUrl as URL;
    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("fortuna.emiliosheinz.com");
    expect(url.pathname).toBe("/api/auth/callback/google");
    expect(url.searchParams.get("code")).toBe("auth-code");
    expect(url.searchParams.get("state")).toBe("state-from-cookie");
  });

  it("redirects to the sign-in page with exchange_failed when the token grant rejects", async () => {
    authorizationCodeGrantMock.mockRejectedValueOnce(
      new Error("invalid_request"),
    );
    const req = mockRequest(
      "https://fortuna.emiliosheinz.com/api/auth/callback/google?code=c&state=state-from-cookie",
    );

    const res = await GET(req);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "/auth/sign-in?sign_in_error=exchange_failed",
    );
  });
});
