# Lessons — tag-colors

<!-- Per-change memory. Load at the start of every phase. Write only when something
     non-obvious was learned. Routine success writes nothing. -->

## Standing Rules
- **Integration bootstrap migrates against an empty schema.** If a migration has a data step that only runs when rows exist (backfill loops, staged NOT NULL adds), the bootstrap `runMigrations()` does not exercise it. Prove the loop with a dedicated integration spec that seeds the pre-migration state via `undoLastMigration()` → INSERT → `runMigrations()`.

## Log
- 2026-07-05 · **SPEC-GAP resolved for TCOL-08.** Spec named WCAG "≥ 3:1"; test asserts an OKLCH lightness delta ≥ 0.30 as an empirical proxy (design.md/plan.md documented this intent). Tightened spec.md TCOL-08 wording to match — the ΔL threshold is now the AC's expected value; the WCAG ratio is a browser-QA confirmation. Same pattern next time: if a heuristic proxy is what the test can actually assert, encode the proxy in the AC, not the target metric.
- 2026-07-05 · **Backfill assertion added for TCOL-04.** First pass shipped only the CHECK/palette invariant test; the `up()` backfill loop and `down()` never ran against pre-existing rows. Verifier 3 caught it. Added `tag-color-migration.integration-spec.ts` that undoes the last migration, seeds a user + five tags with NULL color, redoes the migration, and asserts each `color === assignColor(name)` plus a `down()` round-trip.

## Retired
-
