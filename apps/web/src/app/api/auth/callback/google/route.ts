import { type NextRequest, NextResponse } from "next/server";
import { authorizationCodeGrant } from "openid-client";
import { createGoogleSession } from "@/lib/auth/api-client";
import {
  clearOauthTempCookies,
  OAUTH_NONCE_COOKIE,
  OAUTH_PKCE_COOKIE,
  OAUTH_STATE_COOKIE,
  setSessionCookie,
} from "@/lib/auth/cookies";
import { getOidcConfig } from "@/lib/auth/oidc";

/**
 * OAuth callback for Google sign-in.
 *
 * 1. Reads `state`, PKCE verifier, and nonce from the temp cookies set by
 *    `/api/auth/sign-in`.
 * 2. Exchanges the authorization code for tokens at Google's token endpoint
 *    (PKCE + state + nonce checked by `openid-client`). The access/refresh
 *    tokens are discarded — Fortuna only needs the ID token.
 * 3. Forwards the ID token + nonce to the API, which verifies it and mints a
 *    session.
 * 4. Sets the session cookie on the browser and redirects to `/home`.
 *
 * On any failure, redirects to `/?sign_in_error=<reason>` and surfaces a
 * generic message to the user.
 */
export async function GET(req: NextRequest) {
  const state = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = req.cookies.get(OAUTH_PKCE_COOKIE)?.value;
  const nonce = req.cookies.get(OAUTH_NONCE_COOKIE)?.value;

  if (!state || !codeVerifier || !nonce) {
    return redirectToError("missing_state");
  }

  const config = await getOidcConfig();

  let idToken: string | undefined;
  try {
    const tokens = await authorizationCodeGrant(config, new URL(req.url), {
      expectedState: state,
      expectedNonce: nonce,
      pkceCodeVerifier: codeVerifier,
      idTokenExpected: true,
    });
    idToken = tokens.id_token;
  } catch (err) {
    console.error("[auth/callback] exchange_failed", err);
    return redirectToError("exchange_failed");
  }

  if (!idToken) {
    return redirectToError("no_id_token");
  }

  let sessionToken: string;
  let expiresAt: Date;
  try {
    const result = await createGoogleSession(idToken, nonce, {
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    sessionToken = result.sessionToken;
    expiresAt = new Date(result.expiresAt);
  } catch (err) {
    console.error("[auth/callback] session_mint_failed", err);
    return redirectToError("session_mint_failed");
  }

  const response = relativeRedirect("/home");
  setSessionCookie(response.cookies, sessionToken, expiresAt);
  clearOauthTempCookies(response.cookies);
  return response;
}

function redirectToError(reason: string): NextResponse {
  const response = relativeRedirect(
    `/?sign_in_error=${encodeURIComponent(reason)}`,
  );
  clearOauthTempCookies(response.cookies);
  return response;
}

/**
 * 303 redirect with a relative `Location` header. Bypasses
 * `NextResponse.redirect`, which in dev mode rewrites the origin to
 * `localhost` based on the bind address rather than the request's actual
 * `Host` header (breaks tests behind a docker-network hostname).
 */
function relativeRedirect(location: string): NextResponse {
  const response = new NextResponse(null, { status: 303 });
  response.headers.set("Location", location);
  return response;
}
