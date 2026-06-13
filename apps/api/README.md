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

The cashflow domain converts foreign-currency transactions to the user's base currency at read time using EUR-anchored daily rates from [frankfurter.app](https://www.frankfurter.app/). The product supports four currencies — **USD, EUR, BRL, GBP** — set in `src/fx/constants.ts`. Rates for anything else returned by Frankfurter are dropped on ingest.

### How the daily job works

`FxScheduledJob` fires once a day at 06:00 UTC. Each firing is a self-healing catch-up: it reads the `fx_coverage` watermark (the last date the job has attempted to cover), fetches the open range `(watermark, today]` from Frankfurter, upserts every supported quote currency, and advances the watermark to today. The coverage window starts at `FX_COVERAGE_START_DATE = 2026-01-01`.

Behaviour notes:

- Idempotent: a second firing on the same day finds the watermark already at today and no-ops.
- Self-healing: if the job misses N days, the next firing fetches the full N-day gap in one historical request.
- Coverage anchor: the very first firing fetches `2026-01-01..today` in one shot. Frankfurter conveniently extends the lower bound to the last preceding business day, which gives Jan 1 a backstop rate.
- Currency filter: only USD, BRL, and GBP rows are persisted (EUR is the pivot; same-currency lookup is identity).

### Triggering the job locally

`bin/fortuna fx fetch` runs the same job, via a dev-only `POST /internal/fx/fetch` route. The route returns 404 in production.

```bash
bin/fortuna fx fetch
```

After a fresh `docker compose up -d`, one call seeds the entire supported window. Re-runs are no-ops until tomorrow.

## Local schema reset

```bash
docker compose down -v        # drop the postgres volume
docker compose up -d          # fresh DB; `migration` re-applies everything
```

## Environment variables

Defined in [`.env.example`](./.env.example). The API will refuse to start if `PORT` or `HOST` is missing. Database credentials map directly to the Postgres service in `docker-compose.yaml`.
