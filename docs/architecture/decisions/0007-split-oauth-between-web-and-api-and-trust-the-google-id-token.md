# 7. Split OAuth between web and API; trust the Google ID token

Date: 2026-05-25

## Status

Accepted

## Context

Introducing identity to Fortuna requires deciding which service runs the OAuth flow with Google and how the two services trust each other across the call. Two constraints frame the choice:

- The web app does not hold database access. The API is the only place user data lives.
- The API must be the authoritative identity boundary: a Fortuna session is only ever minted after the API has independently verified the user.

The remaining question is how the web app, which sees the user agent, communicates "this is who just signed in" to the API.

## Decision

- **The web app owns the OAuth Authorization Code + PKCE dance with Google**: building the redirect, handling the callback, exchanging the code for tokens. It uses an OIDC client library rather than hand-rolling the protocol.
- **The API owns identity verification and persistence**: it independently re-verifies the Google ID token against Google's JWKs (signature plus `iss`, `aud`, `exp`, and `nonce`), upserts the user, and mints the session.
- **Cross-service trust is the Google ID token itself**, forwarded server-to-server from web to API on the private network. No shared HMAC or bearer secret sits on top.
- The OAuth access and refresh tokens that come back from Google are discarded. Fortuna does not call any Google API on the user's behalf.

Rejected alternatives:

- **API-owned OAuth callback.** Couples the API to browser-facing redirect concerns and forces it to set cookies. The web framework already does this well.
- **A shared service secret in addition to the ID token.** Adds a rotating credential to no end. Anyone holding a valid Fortuna-audience ID token is, by definition, a legitimate user.

## Consequences

- The API has one cryptographic credential to validate, signed by Google. There is no second secret to provision, store, or rotate between services.
- The web app leverages the request-lifecycle, cookie, and redirect ergonomics of its framework instead of fighting them.
- The two services are coupled through Google's ID token contract, not a private protocol. Swapping the web runtime later does not require API changes.
- The web app stays database-less. This property is preserved by construction.
- The API never depends on Google for anything except JWKs and discovery — outbound failures are narrow and well-understood.
