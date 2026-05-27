# 9. Provider-agnostic identity schema

Date: 2026-05-25

## Status

Accepted

## Context

V1 ships Google sign-in only, but Apple, email/password, and other providers are foreseeable. The shape of the user table becomes load-bearing the moment any user-scoped feature lands — every downstream schema will carry a foreign key to it. Getting it wrong locks in retrofit cost across the entire codebase, and adding a second provider later under a single-provider schema means a destructive migration through every table that references identity.

## Decision

Two tables, separated by responsibility:

- **`users`** holds the canonical Fortuna identity and the profile fields mirrored from the provider (name, email, avatar). Every user-scoped row in every future feature references `users.id`.
- **`identities`** links each user to one or more external identity providers via `(provider, provider_subject)`. The `provider` column is constrained (initially to `'google'`) so future providers are additive inserts, not column changes.

Matching is always on `(provider, provider_subject)` — never on email. The provider's subject claim is stable; email is mutable and reusable at the provider level. A unique index on `(provider, provider_subject)` makes cross-provider collisions impossible.

A user may eventually hold multiple identities. In v1 they hold exactly one.

Rejected alternatives:

- **Single `users` table with per-provider columns** (`google_subject`, `apple_subject`, ...). Every new provider is a destructive schema change; nullable columns multiply; multi-identity-per-user becomes awkward.
- **Provider-specific user table per IdP.** "Who is the current user?" becomes a union across tables, and account linking becomes a cross-table reconciliation problem.

## Consequences

- Adding a provider in the future is a code and config change, not a migration to every user-scoped table.
- The shape mirrors the prevailing industry pattern (Auth.js, Supabase, Clerk, Keycloak), so future contributors are immediately at home.
- "Is this email taken?" requires a join through `identities` instead of reading a single column. The trade is worth it.
- Account linking — letting an existing user attach a second provider — is possible without schema churn when the product needs it.
- The user table is intentionally small in v1. It is the wrong place to add provider-specific fields; those belong on the identity row.
