# 4. Standardize tooling on Biome and Jest via a shared config package

Date: 2026-05-17

## Status

Accepted

## Context

A monorepo with multiple workspaces needs a single, consistent way to lint, format, type-check, and test. Per-workspace tooling drifts: someone updates Prettier here, an ESLint plugin there, and reviews start arguing about formatting. We also want to keep the option for individual workspaces to override behavior that genuinely differs (NestJS parameter decorators, Tailwind CSS directives, React/Next-specific lint rules).

## Decision

- **Lint and format:** [Biome](https://biomejs.dev/) 2.x — single binary, single config, ~10× faster than ESLint + Prettier, no plugin ecosystem to curate.
- **Test runner:** [Jest](https://jestjs.io/) 30 with `ts-jest` for TypeScript transformation.
- **TypeScript:** strict mode plus the safety flags that catch real bugs (`noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `forceConsistentCasingInFileNames`).
- **Distribution:** all three configurations live in `packages/config` and ship as the `@fortuna/config` workspace package, built with `tsup`. It exports `./biome`, `./typescript`, `./jest` so workspaces extend a single source of truth.

Each workspace extends the shared base and overrides only what is genuinely workspace-specific:

- `apps/api` re-enables `unsafeParameterDecoratorsEnabled` for NestJS and disables `useImportType` (incompatible with Nest's DI).
- `apps/web` enables Biome's Tailwind directive parser and turns on the `next` and `react` domains.

## Consequences

- One source of truth for code style. ESLint and Prettier are not installed.
- Lint+format runs are faster, which keeps `pnpm turbo lint format` cheap enough to run on every save.
- A change to the shared config goes through one PR and propagates to every workspace.
- TypeScript strictness is non-negotiable repo-wide. Workspaces cannot loosen the base; they can only add stricter options.
- `@fortuna/config` participates in the Turborepo build graph — workspaces that consume it depend on its `build` output.
