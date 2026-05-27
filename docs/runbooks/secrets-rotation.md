# Secrets Rotation Playbook

Fortuna reads every secret at process start. There is no hot-reload path
— rotating any secret requires a container restart (and in some cases a
coordinated update at the IdP / provider side too).

This document is a checklist per secret. Treat each section as
self-contained; never combine rotations unless you have to.

| Secret                          | Owner   | Restart needed              | IdP/provider step |
| ------------------------------- | ------- | --------------------------- | ----------------- |
| `GOOGLE_CLIENT_SECRET`          | api     | `api` + `web`               | Google Cloud Console |
| `GOOGLE_CLIENT_ID`              | api+web | `api` + `web` (rare)        | Google Cloud Console |
| `REDIS_PASSWORD`                | api+infra | `redis` + `api`           | Local |
| `STATE_COOKIE_SIGNING_KEY` (apps/web) | web | `web`                    | Local |
| `POSTGRES_PASSWORD`             | infra   | `postgres` + `api`          | Local (psql) |

---

## Universal pre-rotation checklist

1. Notify yourself (or the on-call buddy) that a rotation is happening.
2. Take a Postgres snapshot if the secret is `POSTGRES_PASSWORD` — even
   though the rotation is non-destructive in principle, a typo can lock
   you out of your own DB.
3. Update the relevant `.env` file via `scp`/`rsync` to the host —
   `.env` is not in git. Never paste secrets in chat tools that retain
   history.
4. Verify the new secret with `grep ^<NAME> .env` and `wc -c` (rough
   sanity check on length).

---

## `GOOGLE_CLIENT_SECRET`

Used by **apps/web** to exchange the OAuth authorization code at
Google's token endpoint.

1. In the Google Cloud Console, open the OAuth client used by Fortuna
   (project → APIs & Services → Credentials).
2. Click "Add Secret" — this creates a second active client secret
   without invalidating the first. Copy the new value.
3. SSH to the host. Update `apps/web/.env`:
   ```
   GOOGLE_CLIENT_SECRET=<new-secret>
   ```
4. Restart **only** `web` (do not restart `api`, which doesn't read this
   secret):
   ```bash
   docker compose -f docker-compose.prod.yaml up -d web
   ```
5. Verify a manual sign-in works end-to-end.
6. Return to the Google Cloud Console and **delete the old secret**.
   Confirm sign-in still works after deletion (you've now proven the
   new secret is the one being used).

---

## `GOOGLE_CLIENT_ID`

This rarely rotates (only if the OAuth client is being re-created
entirely). Both **apps/web** and **apps/api** read it — `api` uses it as
the required `aud` claim during ID-token verification.

1. Create a new OAuth client in the Google Cloud Console. Configure the
   identical authorized redirect URI.
2. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in **both**
   `apps/api/.env` and `apps/web/.env`.
3. Restart both services:
   ```bash
   docker compose -f docker-compose.prod.yaml up -d api web
   ```
4. Every active session keeps working (sessions are server-side and not
   tied to the client ID). Only the next sign-in needs the new client
   id.
5. Delete the old OAuth client in the console after a one-week soak.

---

## `REDIS_PASSWORD`

Used by **redis** as `--requirepass` and by **apps/api** when
connecting. The two services read from **different** env files in compose
(`./.env` for redis, `./apps/api/.env` for api), so the rotation must
touch both — updating only `./.env` will leave the API on the old
password and the limiter will fail open until the next deploy.

1. Update **both** env files with the same new value:
   ```
   # ./.env             (read by redis)
   REDIS_PASSWORD=<new-password>

   # ./apps/api/.env    (read by api)
   REDIS_PASSWORD=<new-password>
   ```
2. Restart `redis` first, then `api`:
   ```bash
   docker compose -f docker-compose.prod.yaml up -d redis
   docker compose -f docker-compose.prod.yaml up -d api
   ```
3. The rate limiter briefly fails open between the two restarts. The
   `auth_limiter_degraded_total` counter will tick. Confirm it stops
   ticking after `api` has been restarted.
4. Verify with `docker compose exec redis redis-cli -a "$REDIS_PASSWORD"
   ping` returning `PONG`.

---

## `STATE_COOKIE_SIGNING_KEY` (apps/web)

If apps/web's OIDC library uses a signed cookie for `state` / `nonce`
storage, the signing key is read from the web env. Rotating it
invalidates in-flight sign-in attempts (users mid-OAuth will see a
state-mismatch error and have to retry).

1. Generate a fresh key: `openssl rand -base64 48`.
2. Update `apps/web/.env`:
   ```
   STATE_COOKIE_SIGNING_KEY=<new-key>
   ```
3. Restart `web` during low-traffic window:
   ```bash
   docker compose -f docker-compose.prod.yaml up -d web
   ```
4. Users mid-flow during the restart will see "Sign in failed; try
   again." A retry succeeds. The error rate spike is short-lived.

---

## `POSTGRES_PASSWORD`

The most destructive rotation. Plan it carefully.

1. **Take a snapshot first.** On the host:
   ```bash
   docker compose -f docker-compose.prod.yaml exec postgres \
     pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     | gzip > "$HOME/backups/fortuna-$(date +%Y%m%d-%H%M%S).sql.gz"
   ```
2. Connect as a superuser and rotate the password:
   ```bash
   docker compose -f docker-compose.prod.yaml exec postgres \
     psql -U "$POSTGRES_USER" -c "ALTER USER $POSTGRES_USER WITH PASSWORD '<new-password>';"
   ```
3. Update `.env` with the new password.
4. Restart `api` only (Postgres itself does not need to restart — it
   accepts the new password as soon as the `ALTER USER` returns):
   ```bash
   docker compose -f docker-compose.prod.yaml up -d api
   ```
5. Verify the API is healthy: `curl -fsS http://localhost:3000/health`
   (or whatever the health endpoint resolves to).
6. If the API fails to connect, restore the old password via `psql`
   (using the snapshot if the in-place `ALTER USER` is somehow lost) and
   try again.

---

## Post-rotation

- Confirm `auth_signin_attempts_total{outcome="success"}` continues to
  increment on the dashboard.
- Confirm no `failure_internal` spike in the 30 minutes after rotation.
- Note the rotation in a short log entry (date, secret name,
  operator).
