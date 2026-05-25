# 13. Single root .env file, materialized from CI with a whitelist

Date: 2026-05-25

## Status

Accepted

## Context

The monorepo previously kept a separate `.env` per application. Values duplicated across files drifted independently, and "did you update both?" became a recurring failure mode whenever a new variable was added or renamed.

Materializing the runtime environment in CI from a GitHub environment is the right place to source secrets, but a permissive "copy every variable" step risks pulling in arbitrary repository or environment variables, including ones the workflow has no business knowing about and ones whose shape (e.g., multi-line values) is unsafe to inject into a shell-rendered env file.

## Decision

- **One root `.env` file at the monorepo root**, consumed by every application and by the compose stack. The per-app `.env` files are gone. The root `.env.example` is the single contract.
- **CI materializes the runtime `.env` from the workflow environment via a reusable action, whitelisted against `.env.example`.** Only keys present in `.env.example` are passed through. Anything outside the whitelist is dropped silently.
- **Multi-line values are skipped** to avoid shell-injection risk in the materialized file. If a multi-line value is genuinely needed, the action would need a deliberate update rather than an opaque pass-through.
- Local development uses a setup script to seed `.env` from `.env.example`.

Rejected alternatives:

- **Per-app `.env` files.** Drift; "where does this var live?" friction; duplicated values that fall out of sync.
- **Copy-all-env CI step.** Any variable added to the GitHub environment leaks into the runtime by default. New environment variables become an implicit blast radius.

## Consequences

- One file to grep when chasing a variable. One file to keep in sync with `.env.example`.
- Adding a new env var requires updating `.env.example`, or CI drops it silently. The whitelist makes the contract explicit and reviewable.
- The composed runtime in CI matches local development byte-for-byte, modulo secrets.
- Multi-line env vars are unsupported by design. Anything currently encoded that way needs to be base64'd or chunked, or the action contract needs to change in a reviewable PR.
- A misspelled variable in CI is a silent drop, not a misrouted value. That is the intended failure mode.
