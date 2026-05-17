# `@fortuna/config`

Shared lint, format, TypeScript, and Jest configuration for the Fortuna monorepo. See [ADR-0004](../../docs/architecture/decisions/0004-standardize-tooling-on-biome-and-jest.md) for the rationale.

## Exports

| Subpath          | What it is                                  | How to consume                          |
|------------------|---------------------------------------------|------------------------------------------|
| `@fortuna/config/biome`      | Base Biome 2.x config (lint + format)        | `"extends": ["@fortuna/config/biome"]`  in `biome.json` |
| `@fortuna/config/typescript` | Base `tsconfig.json` (strict, safety flags)  | `"extends": "@fortuna/config/typescript"` in `tsconfig.json` |
| `@fortuna/config/jest`       | Base Jest config (ts-jest, coverage, paths)  | `import baseConfig from "@fortuna/config/jest"` in `jest.config.ts` |

## Source

Configs live as plain JSON/TS files in [`base/`](./base/). They are bundled by `tsup` into `dist/`, with the JSON files copied alongside the compiled JS.

## Extending in a workspace

A workspace extends the base and overrides only what is specific to it. Examples:

- `apps/api/biome.jsonc` re-enables parameter decorators (for NestJS) and disables `useImportType` (incompatible with Nest's DI).
- `apps/web/biome.json` enables Biome's Tailwind directive parser and turns on `react` and `next` lint domains.
- `apps/web/tsconfig.json` overrides `jsx` and module settings for Next.js.

The base is intentionally strict. Workspaces can add more rules, not remove them — relaxing TypeScript or lint behavior is a code-review concern, not a per-workspace decision.

## Updating

```bash
bin/fortuna pnpm turbo build --filter=@fortuna/config
```

Workspaces that consume this package pick up the rebuild on their next `lint`/`build`/`test` because they depend on it in the Turborepo graph.
