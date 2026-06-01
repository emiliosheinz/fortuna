/** Name of the session cookie set after successful sign-in. */
export const SESSION_COOKIE_NAME = "fortuna_session";

/** Short-lived cookies carrying OAuth state, PKCE verifier, and nonce. */
export const OAUTH_STATE_COOKIE = "fortuna_oauth_state";
export const OAUTH_PKCE_COOKIE = "fortuna_oauth_pkce";
export const OAUTH_NONCE_COOKIE = "fortuna_oauth_nonce";

/**
 * Long-lived cookie carrying an opaque per-browser identifier. Combined
 * server-side with the UA family to derive the device fingerprint hash.
 */
export const DEVICE_ID_COOKIE_NAME = "fortuna_device_id";
