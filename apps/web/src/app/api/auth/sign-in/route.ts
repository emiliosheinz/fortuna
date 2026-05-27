import { NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from "openid-client";
import { setOauthTempCookies } from "@/lib/auth/cookies";
import { getOidcConfig, getRedirectUri } from "@/lib/auth/oidc";

/**
 * Initiate the OAuth Authorization Code + PKCE flow with Google.
 *
 * Generates a fresh `state`, PKCE `codeVerifier`, and `nonce`; stashes them
 * in short-lived HttpOnly cookies scoped to the callback path so the
 * callback handler can verify them; then 303-redirects to Google's
 * authorize endpoint.
 */
export async function GET() {
  const config = await getOidcConfig();
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
  const state = randomState();
  const nonce = randomNonce();

  const authUrl = buildAuthorizationUrl(config, {
    redirect_uri: getRedirectUri(),
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  const response = NextResponse.redirect(authUrl.toString(), { status: 303 });
  setOauthTempCookies(response.cookies, { state, codeVerifier, nonce });
  return response;
}
