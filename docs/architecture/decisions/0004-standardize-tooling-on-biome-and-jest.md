# 4. Standardize tooling on Biome and Jest via a shared config package

Date: 2026-05-17

## Status

Accepted

## Context

A monorepo with multiple workspaces needs a single, consistent way to lint, format, type-check, and test. Per-workspace tooling drifts: someone updates the formatter here, a lint plugin there, and reviews start arguing about whitespace. We also want to leave room for individual workspaces to override behavior that genuinely differs by domain (backend framework idioms vs. frontend framework idioms).

## Decision

- **Lint and format:** [Biome](https://biomejs.dev/) — single binary, single config, an order of magnitude faster than the ESLint + Prettier combination, no plugin ecosystem to curate.
- **Test runner:** [Jest](https://jestjs.io/) with TypeScript transformation, applied uniformly across workspaces.
- **TypeScript:** strict mode plus the safety flags that catch real bugs (unchecked index access, fallthrough cases, missing overrides, implicit returns, unused locals and parameters, consistent file-name casing).
- **Distribution:** the lint/format, TypeScript, and test configurations live in a single shared internal package consumed by every workspace. Each workspace extends the shared base and overrides only what is genuinely workspace-specific (backend framework decorator semantics; frontend framework lint domains and CSS-framework directive parsing).

## Consequences

- One source of truth for code style. Legacy formatters/linters are not installed.
- Lint and format runs are fast enough to invoke on every save.
- A change to the shared config goes through one PR and propagates to every workspace.
- TypeScript strictness is non-negotiable repo-wide. Workspaces cannot loosen the base; they can only add stricter options.
- The shared config participates in the build graph: workspaces that consume it depend on its build output.
