# 11. Redis sliding-window rate limiter that fails open

Date: 2026-05-25

## Status

Accepted

## Context

Sign-in endpoints attract brute-force traffic and need a limit that survives process restarts and, eventually, horizontal scale. The limiter must see the outcome of the auth flow — success versus a specific failure classification — so that repeated failure against the same identity can trigger escalating backoff. An edge-layer or reverse-proxy limiter cannot see auth outcomes.

Sign-in is also the gate to the entire product. Whatever the limiter is built on, it cannot become a hard dependency that takes the product down with it.

## Decision

- **Sliding-window limiter in the API, backed by Redis.** Per-IP budget on the sign-in and callback path; per-identity escalating backoff on repeated failure outcomes for the same provider subject.
- **Fail open on Redis unavailability.** When Redis is unreachable, the request is allowed, a warn-level structured log is emitted, and a dedicated "limiter degraded" counter metric increments so the existing alerting fires.
- **Limiter responses produce a distinct sign-in outcome classification** so they show up in the audit trail and in the standard sign-in metrics, not as silent drops.

Rejected alternatives:

- **In-memory throttler.** Process-local; resets on restart; useless under any horizontal scale.
- **Reverse-proxy request limit.** Cannot see auth outcome; cannot do per-identity backoff after failed attempts.
- **Postgres counter table.** Write amplification on the hottest path and transactional overhead for what is, intentionally, a soft constraint.

## Consequences

- Limits hold across process restarts and across instances if the API is scaled horizontally.
- A Redis outage degrades sign-in security but does not break sign-in. The trade-off is intentional, surfaced via metrics, and documented in the operator runbook.
- Per-identity backoff is enforceable because the limiter sits inside the auth flow and sees outcomes the edge cannot.
- One more critical-path dependency to operate. The fail-open behavior contains the blast radius; the alert ensures the degraded mode is not silent.
- Limiter behavior is observable: rate-limited attempts contribute to the same sign-in failure metrics and audit rows as any other failure classification.
