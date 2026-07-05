import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PALETTE_KEYS } from "../tag-colors";

// Proxy for a 3:1 non-text contrast: OKLCH lightness must differ from the
// theme background lightness by ≥ 0.30 in both `:root` (L_bg = 1) and
// `.dark` (L_bg = 0.145). The threshold is an empirical stand-in for a
// proper WCAG round-trip; see TCOL-08 gate.
const MIN_DELTA = 0.3;
const ROOT_BG_L = 1;
const DARK_BG_L = 0.145;

const globalsPath = join(__dirname, "..", "..", "..", "app", "globals.css");
const css = readFileSync(globalsPath, "utf8");

function extractBlock(selector: string): string {
  // Match `<selector> { ... }` non-greedily; selectors are `:root` and `.dark`
  // once each in globals.css.
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing CSS block for ${selector}`);
  return match[1];
}

function extractLightness(block: string, key: string): number {
  const re = new RegExp(`--tag-color-${key}\\s*:\\s*oklch\\(\\s*([0-9.]+)`);
  const match = block.match(re);
  if (!match) throw new Error(`Missing --tag-color-${key} declaration`);
  return Number(match[1]);
}

describe("tag palette OKLCH contrast heuristic", () => {
  const rootBlock = extractBlock(":root");
  const darkBlock = extractBlock("\\.dark");

  for (const key of PALETTE_KEYS) {
    it(`--tag-color-${key}: |L − L_bg| ≥ ${MIN_DELTA} in both themes`, () => {
      const rootL = extractLightness(rootBlock, key);
      const darkL = extractLightness(darkBlock, key);
      expect(Math.abs(rootL - ROOT_BG_L)).toBeGreaterThanOrEqual(MIN_DELTA);
      expect(Math.abs(darkL - DARK_BG_L)).toBeGreaterThanOrEqual(MIN_DELTA);
    });
  }
});
