# Operator Runbook — Authentication

Fortuna runs as a single-host Docker compose deployment. This document is
the on-call entry point for the authentication surface.

Each section maps 1:1 to a Prometheus alert. The alert annotation field
`runbook` points back to the matching anchor here.

| Alert / signal                         | Section                              |
| -------------------------------------- | ------------------------------------ |
| `AuthSignInFailureRateHigh`            | [Sign-in failure rate high](#sign-in-failure-rate-high) |
| `AuthRateLimiterBlocksSpike`           | [Abuse spike](#abuse-spike)          |
| `AuthAccountDeletionsSpike`            | [Deletion abuse](#deletion-abuse)    |
| `AuthSignInLatencyP95High`             | [Sign-in latency](#sign-in-latency)  |
| `AuthLimiterDegraded`                  | [Redis down](#redis-down)            |
| Google OAuth verification incident     | [Google outage](#google-outage)      |
| Privacy Policy / Terms of Service question | [PP / ToS questions](#pp--tos-questions) |
| Secrets rotation                       | [Secrets rotation](#secrets-rotation) |

---

## Sign-in failure rate high

> Alert: `AuthSignInFailureRateHigh` — failures (excluding
> `failure_user_cancelled`) > 25% of attempts over 5 minutes.

1. Open the Fortuna · Authentication Grafana dashboard. Note the
   dominant `outcome` label in the "Sign-in attempts by outcome" panel.
2. Map the outcome to a likely root cause:
   - `failure_token_signature` / `failure_token_audience` /
     `failure_token_issuer` — Google JWKs rotation or wrong
     `GOOGLE_CLIENT_ID`. Confirm `GOOGLE_CLIENT_ID` matches the value in
     the GCP console; force a JWKs cache invalidation by restarting
     `api`.
   - `failure_token_expired` — host clock skew. Check `timedatectl` on
     the VPS.
   - `failure_nonce_mismatch` / `failure_state_mismatch` — apps/web
     cookie-handling regression. Confirm the latest deploy.
   - `failure_internal` — server-side exception. Inspect `api` logs
     (`docker compose logs api --since 10m | grep ERROR`).
   - `failure_rate_limited` dominating — see [Abuse spike](#abuse-spike).
3. If the dominant outcome is verification-class and persists after a
   clean deploy: assume Google IdP outage; check
   <https://status.cloud.google.com/> and post a notice on the landing
   page. There is no remediation other than waiting.
4. If the failure rate persists for > 30 minutes and looks deploy-induced,
   revert the offending deploy with `git revert <sha>` + `docker compose
   pull && docker compose up -d api`.

---

## Abuse spike

> Alert: `AuthRateLimiterBlocksSpike` — limiter blocks > 100/min.

1. Inspect the top blocked IPs via the `api` logs:
   ```bash
   docker compose logs api --since 15m \
     | grep "Sign-in blocked by IP limiter" \
     | sed -E 's/.*ip=([^,]+).*/\1/' \
     | sort | uniq -c | sort -rn | head -20
   ```
2. If the traffic is concentrated on a handful of IPs and is clearly
   abusive: block them at the reverse proxy
   (`nginx`/`caddy`/`traefik` — whichever is in front of the compose
   stack). Confirm legitimate sign-ins resume.
3. If the traffic looks distributed (many IPs, low per-IP rate): treat
   as a soft-DDoS. Raise the proxy concurrency limit if needed; do not
   raise the application-level limiter without confirming the alert
   resolves.
4. After the spike subsides, capture a brief incident note in the next
   weekly summary.

---

## Deletion abuse

> Alert: `AuthAccountDeletionsSpike` — `auth_account_deletions_total`
> increased by > 10 in the last hour.

1. **Account deletion is unrecoverable by design.** Do not wait — assess
   immediately whether this is abuse or a regression.
2. Pull the recent deletion events from Postgres:
   ```bash
   docker compose exec postgres \
     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
       SELECT date_trunc('minute', created_at) AS m, count(*)
       FROM sign_in_events
       WHERE outcome = 'success'
         AND created_at > now() - interval '2 hours'
         AND user_id IS NULL  -- anonymized by deletion
       GROUP BY m ORDER BY m DESC LIMIT 30;
     "
   ```
3. If the rate is constant (e.g., one per second) and well above
   baseline: assume regression or automated abuse. Stop the API
   container immediately (`docker compose stop api`) and investigate.
4. If the rate is plausible (e.g., a handful of users using the danger-
   zone flow): post-hoc verify with the support inbox.
5. Document the incident in the next weekly summary regardless of root
   cause.

---

## Sign-in latency

> Alert: `AuthSignInLatencyP95High` — p95 > 2s sustained 10 minutes.

1. Check the "Sign-in latency quantiles" Grafana panel. If p99 is
   blown out but p50 looks normal, the issue is tail latency — often
   Google JWKs or a slow Postgres query.
2. Confirm Postgres health:
   ```bash
   docker compose exec postgres pg_isready -U "$POSTGRES_USER"
   docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -c "SELECT count(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > now();"
   ```
3. If Postgres looks healthy, check Google JWKs latency: `curl -o /dev/null
   -w "%{time_total}\n" https://www.googleapis.com/oauth2/v3/certs`.
   Anything > 0.5s sustained warrants a Google status check.
4. Restart `api` if neither Postgres nor Google look slow — the
   verifier's JWKs cache may be in a stuck state.

---

## Redis down

> Alert: `AuthLimiterDegraded` — `auth_limiter_degraded_total`
> increased.

Fortuna's rate limiter fails open when Redis is unreachable: sign-ins
continue without rate limiting until Redis recovers.

1. Check Redis health:
   ```bash
   docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping
   docker compose logs redis --since 5m
   ```
2. Common causes:
   - OOM kill on the host — check `dmesg | tail`.
   - Disk pressure — `df -h` on the host.
   - Connection storm from a runaway worker — check `api` logs.
3. Restart Redis: `docker compose restart redis`. The limiter recovers
   automatically on the next op.
4. If Redis is down for > 30 minutes, post a status notice. Sign-ins
   succeed during the outage, but with the limiter unavailable, endpoints
   it normally protects (per-IP sign-in throttling, identity-scoped
   backoff) are exposed to brute-force attempts until Redis recovers.
5. After Redis recovers, confirm `auth_limiter_degraded_total` stops
   incrementing.

---

## Google outage

Fortuna depends on Google's discovery, JWKs, and token endpoints. There
is no failover.

1. Confirm the outage at <https://status.cloud.google.com/> and at
   <https://status.cloud.google.com/products/identity-services>.
2. Post a status notice on `/` (landing page) explaining the disruption.
3. Do not change Fortuna config. Sign-in will return automatically when
   Google's identity surface recovers.
4. After recovery, watch the failure-rate panel for residual
   `failure_token_*` outcomes — Google sometimes ships JWKs rotations on
   the tail of outages.

---

## PP / ToS questions

A user asks where the Privacy Policy or Terms of Service can be found,
or contests something on either page.

1. Public URLs: `/privacy` and `/terms` on the production origin.
2. The authoritative DPO contact for LGPD requests is the project
   maintainer's email (see `MEMORY.md` for current contact).
3. Subject-access / deletion requests: direct the user to use the
   self-service "Delete account" flow on the Settings page. There is no
   admin-side deletion path on purpose.
4. Disputes about the wording of `/privacy` or `/terms`: file an issue;
   do not edit the pages in production without legal review.

---

## Secrets rotation

See [docs/runbooks/secrets-rotation.md](./secrets-rotation.md). The
short version is: every secret is read once at process start; rotation
requires a redeploy or container restart, never a hot reload.
