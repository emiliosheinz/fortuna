# 8. Opaque session tokens with server-side state

Date: 2026-05-25

## Status

Accepted

## Context

Per-device sessions are a hard requirement: users can sign out one device, revoke another from a settings page, and delete their account — each of these must take effect on the next request, with no grace window.

The standard "stateless" alternative — short-lived JWTs paired with a refresh token — does not give that property without bolting a server-side denylist on top, which re-introduces the same per-request lookup the JWT was supposed to avoid.

The API already talks to PostgreSQL on every authenticated request, so an indexed session lookup fits inside the same network trip.

## Decision

- Sessions are opaque, random tokens. The cookie carries the raw value; only its SHA-256 hash is stored.
- The session guard hashes the cookie on every authenticated request and looks up the row. Missing, revoked, or expired sessions return 401 with no internal detail leaked to the client.
- Idle expiry slides by 30 days on use, but the database write to record the slide is **throttled**: it only persists if at least 5 minutes have elapsed since the previous slide. The in-memory representation of the session governs the current request's expiry.
- Revocation is a single column write. Account deletion cascades through the session table.

Rejected alternatives:

- **Short-lived JWT + refresh token.** Revocation requires either a denylist (same lookup as opaque sessions) or accepting a window where revoked tokens stay valid. Neither is acceptable given the sign-out and account-deletion requirements.
- **Per-request `last_active_at` write.** Turns every authenticated request into a write on the hottest table in the system. The throttled slide gives the same UX for a tiny fraction of the cost.

## Consequences

- Revocation is correct by construction. The next request after a revoke is denied, no exceptions.
- A database leak exposes hashes, not usable session tokens.
- Every authenticated request pays one indexed lookup. If contention becomes real, an in-memory cache fits cleanly behind the same interface without changing the contract.
- The throttled slide trades up to 5 minutes of staleness in `last_active_at` for a roughly two-orders-of-magnitude reduction in writes.
- No JWT library, no signing-key rotation, no token-format migration story to maintain.
