/**
 * Web-side mirror of the api-side palette. A repo-invariant test asserts
 * this list deep-equals `apps/api/src/cashflow/tag-colors.ts` `PALETTE_KEYS`.
 * Every CSS custom property `--tag-color-<key>` is defined in
 * `apps/web/src/app/globals.css` for both `:root` and `.dark`.
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

/**
 * Resolve a tag color to a CSS `var(...)` reference. `null` maps to the
 * theme's muted-foreground token — used for the synthetic Untagged bucket in
 * the pie chart.
 */
export function tagColorVar(color: PaletteKey | null): string {
  if (color === null) return "var(--muted-foreground)";
  return `var(--tag-color-${color})`;
}
