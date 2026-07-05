# Spec — Tag Colors

| Field | Value |
|-------|-------|
| Slug | tag-colors |
| Author | @emiliosheinz |
| Date | 2026-07-05 |
| Size | standard |
| Mode | full |

## Part A — Understanding

### Problem
Tags are a flat, user-scoped label attached to income and expense transactions. They currently render as identical neutral chips across many surfaces (TagInput chips, TagInput dropdown, TagsManager list, transaction list row, filter bar, TagDrillDown page heading, and TagPie slices). The user cannot visually distinguish tags at a glance: reading a stack of transactions, scanning the pie chart, or picking from the multi-select all require reading each tag's text. In the TagPie the situation is worse than "colorless": slices are auto-colored from a rotating palette (`--chart-1..5`) that has no stable relationship to the tag identity, so the color for `# groceries` today can be a different color tomorrow, and re-orderings shift every slice.

The user (solo owner of the app) wants to attribute a color to each tag so that color travels with the tag everywhere it is rendered.

### Constraints
- Backend is NestJS + PostgreSQL + TypeORM. Migrations are generated from entities via `bin/fortuna db migration:generate <Name>`, never hand-written.
- Frontend is Next.js with vendored shadcn components. Never edit shadcn source; customize via wrappers/theming.
- Tag rows already exist for every user; a migration must backfill without asking the user to recolor everything.
- Palette must render acceptably in both light and dark themes (the app supports both).

### Prior Art
| Solution / Approach | Source (internal / URL) | Key finding | Applicability (H/M/L — why) |
|---|---|---|---|
| Prior `TagPie` auto-palette (`--chart-1..5`) | `apps/web/src/lib/cashflow/components/tag-pie.tsx:15` | 5-color rotating palette keyed by list order. Currently produces unstable slice colors as tags are added/removed/reordered. | H — the "everywhere" render includes the pie; this palette must be superseded by a per-tag color. |
| Existing `Tag` entity and `TagResponse` | `apps/api/src/cashflow/entities/tag.entity.ts`, `apps/api/src/cashflow/services/tags.service.ts:10` | Tag is `{id, userId, name, createdAt}` with a unique constraint on `(userId, name)`. `TagResponse` DTO is `{id, name}`. | H — the color field lives on this entity and this response shape. |
| `resolveOrCreateByName` implicit tag creation | `apps/api/src/cashflow/services/tags.service.ts:69` | Tags are silently created during transaction capture when a name doesn't exist. This path must auto-assign a color too. | H — the auto-assignment logic must apply on both explicit and implicit creation. |

### Codebase Findings
- **Tag entity.** `apps/api/src/cashflow/entities/tag.entity.ts` uses `declare` fields (per feedback_typeorm_declare_fields), unique on `(user_id, name)`, cascades to `TransactionTag`.
- **TagDto.** `apps/api/src/cashflow/dto/tag.dto.ts` has one field (`name`), trimmed, non-empty, ≤100 chars. Used for both `POST /tags` and `PATCH /tags/:id`.
- **TagsService.** Handles `create`, `list`, `rename`, `remove`, and `resolveOrCreateByName` (implicit-by-name). Unique-violation mapping is name-only.
- **TagResponse.** `{id, name}` on every read path (`list`, `create`, `rename`, and inside `resolveOrCreateByName`).
- **TagDrillDownResponse.** Contains `tag: {id, name}` — same shape as `TagResponse`.
- **TagBucket (summary).** Contains `{tagId, tagName, income, expense, net}` — no color today. The synthetic "Untagged" bucket uses `tagId: null`.
- **Frontend types.** `apps/web/src/lib/cashflow/types.ts` mirrors the API. `Tag`, `TagBucket`, `TagDrillDownResponse.tag` all lack color.
- **Render surfaces** (all inside `apps/web/src/lib/cashflow/components/`):
  - `tags-manager.tsx` — list rows show `{tag.name}` only.
  - `tag-input.tsx` — selected chips render `<span class="bg-accent…">{name}</span>` (line 116-135); dropdown options render a checkbox + name (line 171-188).
  - `tag-pie.tsx` — slice fill from `tagColor(index)` (line 84); untagged uses same rotation.
  - `tag-drill-down-view.tsx` — heading is `# {tag.name}` (line 36).
  - `transaction-list.tsx:180-190` — per-row tag chips styled `bg-accent px-2 py-0.5 text-xs`.
  - `transaction-filter-bar.tsx:303` — resolves selected tag id → name for a chip.
- **Migrations rule.** Migrations must be generated after the entity change; a backfill data script runs inside the migration's `up()` (this is the established pattern per feedback_migrations_generated_not_handwritten).
- **DB access boundary.** Only `apps/api` touches the database; `apps/web` reads via the HTTP client (feedback_db_access_backend_only).
- **No `color` symbol on tags today.** A grep confirms no `Tag.color`, `tag.color`, or palette module exists in the cashflow domain.

### Impact / Blast Radius
| Area the change would touch | What currently depends on it | Integration boundary | Existing in-domain prior art |
|---|---|---|---|
| `Tag` entity + `tags` table | `TransactionTag` join, `TagsService.*`, `TagDrillDownService`, cashflow summary aggregation | Postgres schema (migration + backfill) | Prior `RemoveCashflowCategories` migration pattern for entity-generated + data step (see git log 92b5a76, 29c9be6) |
| `TagResponse` shape | Every consumer of `POST/GET/PATCH /tags` (web `hooks.ts`, `api-client.ts`, `types.ts`) | HTTP contract | `TagResponse` is defined once in `tags.service.ts:10` and re-exported |
| `TagBucket` shape (summary) | `SummaryResponse.byTag`, `TagPie`, dashboard This-month card | HTTP contract on `GET /cashflow/summary` | `byTag` already carries `tagName` alongside `tagId` |
| `TagDrillDownResponse.tag` shape | `TagDrillDownView` heading | HTTP contract on `GET /tags/:id/drill-down` | Same shape as `TagResponse` |
| `TagInput`, `TagsManager`, transaction-list row, filter-bar chip, `TagPie`, `TagDrillDownView` heading | End-user rendering surfaces | Frontend only | Six sibling components already consume tags |

### External References
| Reference | URL (fetched) | Key finding |
|---|---|---|
| (none) | — | Web search not required for a scoped internal change with a clear precedent (`RemoveCashflowCategories`) inside the repo. |

### Open Questions
| Question | Why it matters | Owner | Status |
|---|---|---|---|
| — | — | — | — |

<!-- Part A closure gate: user confirmed all six render surfaces (chips + dropdown + manager + pie + drill-down + tx row + filter-bar) plus visual pattern (colored circle beside the name for chip-style surfaces). -->

---

## Part B — Requirements

### Overview
Every tag carries a color drawn from a small, curated, dark/light-safe palette. The color is assigned automatically on tag creation (both explicit via `POST /tags` and implicit via transaction capture) using a deterministic hash of the tag name, and can be re-picked by the user in the tag manager. The color travels with the tag everywhere it renders: as a colored dot beside the name on chip-style surfaces, and as the slice fill in the tag pie chart. Existing tags are backfilled by the same deterministic hash on migration.

### Goals & Success Criteria
| Goal | Success criterion | How to measure |
|---|---|---|
| A user can visually distinguish tags at a glance | Every tag renders with a color across all six surfaces | Manual scan of TagsManager, TagInput chips + dropdown, transaction list, filter bar, TagPie, TagDrillDown |
| Color follows the tag identity, not list order | The same tag id yields the same color across renders and reloads | Reload the app, observe the same slice/chip color |
| Onboarding cost is zero | Every existing tag has a non-null color after migration; no UI prompts the user to pick | Post-migration DB check + first-run visual on TagsManager |

### Scope

**In scope:**
- Add a `color` field to the `Tag` entity, persisted in Postgres, exposed on every read path (`TagResponse`, `TagBucket`, `TagDrillDownResponse.tag`).
- Deterministic hash-of-name backfill for all existing rows during migration.
- Auto-assignment of a color via the same deterministic hash on both explicit (`POST /tags`) and implicit (`resolveOrCreateByName`) creation.
- User can change a tag's color from the tag manager (rename dialog gets a color picker, or a dedicated "Change color" affordance — design's call).
- Render the tag color on all six surfaces:
  - TagInput chips (colored dot before the name)
  - TagInput dropdown options (colored dot before the name)
  - TagsManager list rows (colored dot before the name)
  - Transaction list row chips (colored dot before the name)
  - Filter bar tag chip (colored dot before the name)
  - TagDrillDown page heading (colored dot before the title)
  - TagPie slices (fill = tag color; untagged bucket keeps a neutral fallback)

**Out of scope:**
| Item | Reason |
|---|---|
| Freeform hex color / full color picker | User chose fixed palette in Part A. Palette-only keeps contrast/accessibility trivial. |
| Filtering, sorting, or grouping tags by color | Colors are visual identity, not a query dimension. |
| Multi-user color sharing / palette customization per user | Solo app; a curated palette is enough. |
| Enforcing color uniqueness per user | Two tags may share a color when the palette is smaller than the tag count. Editable by the user if collision is confusing. |
| Retro-recoloring `TagPie` history or memoizing legend colors independent of the tag color | The tag's own color IS now the source of truth; no separate legend memory needed. |
| Icons per tag (e.g. emoji) | Distinct feature; not raised. |

**Deferred Ideas:** (none raised during specify)

### Requirements & Acceptance Criteria

- **[P0] TCOL-01** — Every persisted tag SHALL carry a non-null palette-key color.
  - AC: WHEN a tag row exists in the database (created before or after this feature), THEN its `color` column SHALL be a non-null value drawn from the defined palette.

- **[P0] TCOL-02** — Explicit tag creation SHALL auto-assign a color from the palette using a deterministic hash of the tag name. The palette (ordered list of keys) and the hash function SHALL be frozen constants at design time; tests assert against those frozen constants.
  - AC: WHEN a user creates a tag via `POST /tags` with name `X`, THEN the response's `tag.color` SHALL equal `palette[hash(X) mod palette.length]` computed from the frozen palette/hash.
  - AC: WHEN two tags with the same name `X` are created against the same palette version (independent of user), THEN both SHALL receive the same palette-key color.

- **[P0] TCOL-03** — Implicit tag creation during transaction capture SHALL auto-assign a color by the same rule as TCOL-02.
  - AC: WHEN a user captures a transaction with a tag name that does not yet exist, THEN the newly created tag row SHALL have a `color` equal to `palette[hash(name) mod palette.length]`.

- **[P0] TCOL-04** — Existing tag rows SHALL be backfilled with a color by the same deterministic hash on migration.
  - AC: WHEN the migration runs `up()`, THEN every pre-existing tag row SHALL have its `color` set to `palette[hash(name) mod palette.length]`.
  - AC: WHEN the migration runs `down()`, THEN the `color` column SHALL be removed.

- **[P0] TCOL-05** — The tag color SHALL be exposed on every read path that returns a tag.
  - AC: WHEN a client calls `GET /tags`, THEN each item SHALL include a `color` field with a palette key.
  - AC: WHEN a client calls `POST /tags` or `PATCH /tags/:id`, THEN the returned `tag` SHALL include a `color` field with a palette key.
  - AC: WHEN a client calls `GET /tags/:id/drill-down`, THEN the `tag` object SHALL include a `color` field with a palette key.
  - AC: WHEN a client calls `GET /cashflow/summary`, THEN each `byTag` bucket with a non-null `tagId` SHALL include a `color` field with a palette key.
  - AC: WHEN a client calls `GET /cashflow/summary`, THEN a `byTag` bucket with `tagId: null` (the synthetic Untagged bucket) SHALL have `color: null`.

- **[P0] TCOL-06** — A user SHALL be able to change a tag's color, and renaming a tag SHALL preserve its color.
  - AC: WHEN a client sends `PATCH /tags/:id` with an optional `color` in the body set to a palette key, THEN the server SHALL persist the new color and the returned `tag.color` SHALL equal the submitted key.
  - AC: WHEN a client sends `PATCH /tags/:id` with a `color` that is not one of the palette keys, THEN the server SHALL respond `400` and SHALL NOT mutate the row.
  - AC: WHEN a client sends `PATCH /tags/:id` with only a `name` change (no `color` in the body), THEN the persisted `color` SHALL be unchanged.
  - AC: WHEN a user opens the tag manager, picks a new palette color for a tag, and the request succeeds, THEN a subsequent `GET /tags` SHALL return that tag with the newly picked `color`.

- **[P0] TCOL-07** — The tag color SHALL render on every surface that renders the tag today.
  - AC: WHEN the TagInput popover shows the selected chips, THEN each chip SHALL display a colored dot in the tag's color beside the name.
  - AC: WHEN the TagInput dropdown lists tags, THEN each option row SHALL display a colored dot in the tag's color beside the name.
  - AC: WHEN the TagsManager renders the list, THEN each row SHALL display a colored dot in the tag's color beside the name.
  - AC: WHEN a transaction list row renders its tag chips, THEN each chip SHALL display a colored dot in the tag's color beside the name.
  - AC: WHEN the transaction filter bar renders the selected-tag chip, THEN it SHALL display a colored dot in the tag's color beside the name.
  - AC: WHEN the TagDrillDown page renders its heading, THEN a colored dot in the tag's color SHALL render beside the `# name`.
  - AC: WHEN the TagPie renders a slice for a bucket with a non-null `tagId`, THEN the slice fill SHALL be that tag's color.
  - AC: WHEN the TagPie renders a slice for the synthetic Untagged bucket (`tagId: null`), THEN the slice fill SHALL be the theme's muted foreground token.
  - AC: WHEN the TagPie renders its legend, THEN each legend swatch SHALL match its corresponding slice fill (tag color for real buckets, muted fallback for Untagged).

- **[P1] TCOL-08** — Every palette color SHALL meet an OKLCH lightness-delta proxy (≥ 0.30 against the theme's `--background` lightness in each theme) as an empirical stand-in for a WCAG non-text contrast ratio ≥ 3:1. The proxy is what tests assert; a one-shot manual browser check at ship time confirms the ≥ 3:1 WCAG number.
  - AC: WHEN a palette color renders as a dot on a surface using the `bg-background` token, THEN `|L_palette − L_background| ≥ 0.30` in the `:root` theme.
  - AC: WHEN a palette color renders as a dot on a surface using the `bg-background` token, THEN `|L_palette − L_background| ≥ 0.30` in the `.dark` theme.

- **[P2] TCOL-09** — When a color update fails, the tag manager SHALL surface an inline error and preserve the user's picked color in the picker.
  - AC: WHEN `PATCH /tags/:id` returns a 4xx or 5xx response after a color pick, THEN an inline error message SHALL render adjacent to the picker.
  - AC: WHEN `PATCH /tags/:id` returns a 4xx or 5xx response after a color pick, THEN the picker SHALL remain open with the attempted palette key pre-selected.

### Assumptions & Discretion

**Assumptions (unconfirmed):**
- The palette is a small (~8–12) named-slot set defined in a shared module (e.g. `packages/` or duplicated on api+web). Design settles the exact count, storage form (slot key vs hex), and shared module vs duplication. — Would invalidate the spec only if the "palette-only" answer changes.
- Persisting the palette key (e.g. `"amber"`, `"rose"`) is preferred over persisting a raw hex, so the app can retune the palette hex values later without a migration. Design confirms.
- **Palette keys are a persisted contract.** Renaming a slot key later requires a data migration. Design picks keys that will not need to change (`amber`, `rose`, `sky`, …), not ergonomic short-lived names.
- The unique-violation mapping in `TagsService` continues to apply only to `(userId, name)`. Color is not part of any uniqueness rule.
- Extending `TagDto` with an optional `color` field is the intended path for both `POST` and `PATCH`. Design confirms whether the DTO stays shared or splits.

**Agent discretion (user delegated):**
- Palette size and exact slot names/hex values (subject to light/dark contrast). Design picks; user reviews.
- Hash function choice (any stable, non-cryptographic string hash — e.g. FNV-1a). Design picks.
- Whether the color picker lives inside the existing rename dialog or as a separate affordance in the list row. Design picks.
- Exact dot size, shape (dot vs square), and CSS wrapper. Design/implementation picks.
- Whether `TagResponse` uses `color: string` (palette key) or a richer `{key, hex}` shape. Design picks.

### Edge conditions
- **Empty tag list:** unchanged; the manager keeps its existing "No tags yet." empty state.
- **First-run:** new user has no tags; the first tag they create receives a color per TCOL-02.
- **Palette shorter than tag count:** two tags may share a color. This is accepted (see out-of-scope); the user can recolor one to disambiguate.
- **Untagged pie bucket (`tagId: null`):** keeps a neutral muted fill regardless of palette state (per TCOL-07 last AC).
- **Concurrent explicit + implicit creation with the same name:** existing unique constraint plus `resolveOrCreateByName` idempotency already handle this; the same deterministic hash means both paths compute the same color.
