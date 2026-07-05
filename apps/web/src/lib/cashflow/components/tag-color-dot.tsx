import { tagColorVar } from "../tag-colors";
import type { PaletteKey } from "../types";

interface TagColorDotProps {
  color: PaletteKey | null;
  label?: string;
}

/**
 * Small filled circle that carries a tag's identity color across every
 * chip-style surface (TagInput chip + dropdown, TagsManager row, tx-list
 * chip, filter-bar chip, drill-down heading). `color === null` maps to the
 * theme's muted-foreground token — used by the Untagged pie bucket only.
 */
export function TagColorDot({ color, label }: TagColorDotProps) {
  if (label) {
    return (
      <span
        data-testid="tag-color-dot"
        data-color={color ?? "untagged"}
        role="img"
        aria-label={label}
        className="block size-2.5 shrink-0 rounded-full"
        style={{ background: tagColorVar(color) }}
      />
    );
  }
  return (
    <span
      data-testid="tag-color-dot"
      data-color={color ?? "untagged"}
      aria-hidden
      className="block size-2.5 shrink-0 rounded-full"
      style={{ background: tagColorVar(color) }}
    />
  );
}
