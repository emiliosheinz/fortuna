/**
 * Frozen ordered palette of ten keys used to color tags across the app. The
 * key is persisted in the `tags.color` column and mirrored by the web-side
 * palette module. A repo-invariant test enforces api ↔ web equality; a second
 * invariant test enforces migration CHECK ↔ palette equality. Renaming a key
 * requires a data migration.
 */
export const PALETTE_KEYS = [
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
  "slate",
  "orange",
  "lime",
  "cyan",
  "pink",
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

/** FNV-1a 32-bit hash. Non-cryptographic, deterministic across processes. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic name → palette key. Same name always yields the same key
 * against a fixed `PALETTE_KEYS` order. Used on explicit creation, implicit
 * creation, and the migration backfill.
 */
export function assignColor(name: string): PaletteKey {
  return PALETTE_KEYS[fnv1a32(name) % PALETTE_KEYS.length];
}
