import {
  allowInsecureRequests,
  type Configuration,
  discovery,
} from "openid-client";

let cached: Promise<Configuration> | null = null;

/**
 * Lazy-loaded OIDC `Configuration` shared across requests.
 *
 * `discovery()` performs a network call to the issuer's well-known endpoint;
 * caching avoids re-fetching on every sign-in/callback. The returned
 * configuration carries the client credentials and any `execute` hooks (e.g.
 * {@link allowInsecureRequests} when targeting an HTTP issuer in dev/e2e).
 */
export function getOidcConfig(): Promise<Configuration> {
  if (!cached) {
    cached = buildConfig();
  }
  return cached;
}

async function buildConfig(): Promise<Configuration> {
  const issuer = requireEnv("OIDC_ISSUER_URL");
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  // Production must use an HTTPS issuer (Google); dev and e2e talk to a
  // local mock-oauth2-server over plain HTTP.
  const isProduction = process.env.NODE_ENV === "production";
  return discovery(
    new URL(issuer),
    clientId,
    clientSecret,
    undefined,
    isProduction ? undefined : { execute: [allowInsecureRequests] },
  );
}

/** Read an env var, throwing if missing. Used at module load / request time. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} must be set`);
  }
  return value;
}

/** Public OAuth redirect URI registered with the IdP. */
export function getRedirectUri(): string {
  return requireEnv("GOOGLE_REDIRECT_URI");
}
