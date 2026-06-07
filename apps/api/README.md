# API

Fortuna's backend, built with NestJS 11, TypeORM 0.3, and PostgreSQL 17. See [ADR-0002](../../docs/architecture/decisions/0002-adopt-nestjs-typeorm-and-postgresql-for-the-api.md) for the rationale behind the stack.

For day-to-day development workflow (Docker, `bin/fortuna`, tests), see the top-level [development guide](../../docs/development.md).

## Database access policy

Only this app touches the database. The web app fetches everything over HTTP. If something in `apps/web` needs database data, it goes through an API endpoint.

## Migrations

Migrations are managed by TypeORM and live in [`src/database/migrations/`](./src/database/migrations/). They are applied automatically when you run `docker compose up` (the `migration` service runs before `api` starts), so a fresh checkout already has the schema applied.

For manual control, use `bin/fortuna db`, which runs the TypeORM CLI inside a dedicated container.

### Generate a migration

TypeORM compares the current entity definitions against the live database and writes the diff:

```bash
bin/fortuna db migration:generate <MigrationName>
```

The generated file lands in `src/database/migrations/`. **Read the SQL before committing.** Both `up` and `down` should be reviewed — generated code is a starting point, not a final answer.

### Apply pending migrations

```bash
bin/fortuna db migration:run
```

### Revert the last migration

```bash
bin/fortuna db migration:revert
```

Reverts only the most recently applied migration. Run again to step further back.

### Show status

```bash
bin/fortuna db migration:show
```

Lists every migration with an `[X]` next to the ones that have been applied.

## FX rates

The cashflow domain converts foreign-currency transactions to the user's base currency at read time using EUR-anchored daily rates from [frankfurter.app](https://www.frankfurter.app/). A daily cron (`FxScheduledJob`) pulls the latest rates at 06:00 UTC; in dev you usually want to populate rates on demand.

`bin/fortuna fx fetch` triggers the same job the cron runs, via a dev-only `POST /internal/fx/fetch` route on the API. The route returns 404 in production.

### Pull today's rates (no args)

```bash
bin/fortuna fx fetch
```

Runs `FxFetchService.fetchAndPersistLatest()` — identical to the daily cron. Use this after a fresh `docker compose up -d` to seed today's row.

### Backfill from a date until today

```bash
bin/fortuna fx fetch --from 2026-06-01
```

Useful when seeding a window of recent rates for the transactions you're about to capture.

### Backfill an explicit range

```bash
bin/fortuna fx fetch --from 2026-05-01 --to 2026-05-31
```

Both bounds inclusive. Run before a historical cutover so older transactions resolve cleanly.

All three modes upsert against the `(rate_date, base_currency, quote_currency)` primary key, so repeat invocations are idempotent.

## Local schema reset

```bash
docker compose down -v        # drop the postgres volume
docker compose up -d          # fresh DB; `migration` re-applies everything
```

## Environment variables

Defined in [`.env.example`](./.env.example). The API will refuse to start if `PORT` or `HOST` is missing. Database credentials map directly to the Postgres service in `docker-compose.yaml`.
