# 2. Adopt NestJS, TypeORM, and PostgreSQL for the API

Date: 2026-05-17

## Status

Accepted

## Context

Fortuna's API handles financial domain logic — accounts, transactions, goals, investments. We need:

- Relational integrity (a transaction's account must exist; deletes need referential rules).
- Accurate money handling (no floating-point arithmetic for currency).
- A backend framework with strong conventions so a solo maintainer can move quickly without re-deciding structure each time.
- A schema that is versioned and reproducible across environments.

## Decision

- **Framework:** NestJS. Provides modules, dependency injection, decorators, a testing harness, and an established convention for layered architecture. The opinionation pays back when the team is one person.
- **ORM:** TypeORM. Decorator-driven entities match the framework's style and ship a first-class migration workflow.
- **Database:** PostgreSQL. Strong support for exact-precision numerics (for money), constraints, partial indexes, generated columns, and JSONB for flexible attributes when relational modeling is overkill.

Schema and runtime conventions:

- The database schema is never auto-derived from entities at runtime. Migrations are the only path that changes the schema, in every environment.
- Migrations are generated from entity diffs, reviewed by hand before commit, and applied automatically before the application starts.
- The database connection used for migrations is defined separately from the application's runtime wiring, so schema changes can run without booting the rest of the app.

## Consequences

- Entities are the source of truth for schema diffs, but migrations are the source of truth for what actually runs in the database. The pull request is the place to catch dangerous generated SQL.
- Money is modeled with exact-precision numerics, not floating-point types.
- Database access stays inside the API. The web app never connects to the database directly.
- A new entity always means a new migration commit; there is no shortcut.
