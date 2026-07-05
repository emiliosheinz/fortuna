import { PALETTE_KEYS, tagColorVar } from "../tag-colors";

describe("PALETTE_KEYS", () => {
  it("is a frozen tuple of ten keys in fixed order", () => {
    expect(PALETTE_KEYS).toEqual([
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
    ]);
  });
});

describe("tagColorVar", () => {
  it.each(PALETTE_KEYS)("resolves %s to var(--tag-color-<key>)", (key) => {
    expect(tagColorVar(key)).toBe(`var(--tag-color-${key})`);
  });

  it("resolves null to the muted-foreground token", () => {
    expect(tagColorVar(null)).toBe("var(--muted-foreground)");
  });
});
