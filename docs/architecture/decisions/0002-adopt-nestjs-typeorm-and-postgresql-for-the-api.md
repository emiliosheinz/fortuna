# 2. Adopt NestJS, TypeORM, and PostgreSQL for the API

Date: 2026-05-17

## Status

Accepted

## Context

Fortuna's API handles financial domain logic — accounts, transactions, goals, investments. We need:

- Relational integrity (a transaction's account must exist; deletes need referential rules).
- Accurate money handling (no floating-point arithmetic for currency).
- A backend framework with strong conventions so a solo maintainer can move quickly without re-deciding structure each time.
- A schema that's versioned and reproducible across environments.

## Decision

- **Framework:** NestJS 11. Provides modules, dependency injection, decorators, a testing harness, and an established convention for layered architecture. The opinionation pays back when the team is one person.
- **ORM:** TypeORM 0.3. Decorator-driven entities match NestJS style and ship a first-class migration workflow.
- **Database:** PostgreSQL 17. Strong support for `numeric` (exact money), constraints, partial indexes, generated columns, and `jsonb` for flexible attributes when relational modeling is overkill.

Schema and runtime conventions:

- `synchronize: false` always. The database schema is never auto-derived from entities at runtime — migrations are the only path.
- Migrations are generated from entity diffs (`bin/fortuna db migration:generate`), reviewed by hand before commit, and applied automatically on `docker compose up` in development and as a dedicated `migration` service in production compose.
- The TypeORM `DataSource` used by the CLI lives in `apps/api/src/database/connection.ts`, separate from the runtime `AppModule` wiring, so migrations can run without booting the rest of the app.

## Consequences

- Entities are the source of truth for schema diffs, but migrations are the source of truth for what actually runs in the database. The pull request is the place to catch dangerous generated SQL.
- Money is modeled with `numeric`, not `float`/`double`.
- Database access stays inside `apps/api`. The web app never connects to the database directly (see also: project memory on this constraint).
- A new entity always means a new migration commit; there is no shortcut.
- PostgreSQL features (JSONB, partial indexes, window functions) are fair game — we are not preserving portability to other databases.
