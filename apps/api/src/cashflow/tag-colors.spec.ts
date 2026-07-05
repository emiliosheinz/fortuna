import { assignColor, fnv1a32, PALETTE_KEYS } from "./tag-colors";

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

describe("assignColor", () => {
  // Concrete expectations pin both the FNV-1a hash and the modulo — a change
  // to either the hash or the palette-size divisor would break these.
  it.each<[string, string]>([
    ["groceries", "slate"],
    ["rent", "orange"],
    ["travel", "violet"],
    ["food", "emerald"],
    ["transport", "cyan"],
  ])("maps %s to a fixed palette key", (name, expected) => {
    expect(assignColor(name)).toBe(expected);
  });

  it("is deterministic across repeated calls", () => {
    expect(assignColor("groceries")).toBe(assignColor("groceries"));
    expect(assignColor("subscription")).toBe(assignColor("subscription"));
  });

  it("returns a member of PALETTE_KEYS for arbitrary inputs", () => {
    for (const name of ["", "a", "áéí", "🍕", "long-tag-name-with-hyphens"]) {
      expect(PALETTE_KEYS).toContain(assignColor(name));
    }
  });
});

describe("fnv1a32", () => {
  it("matches the FNV-1a 32-bit reference vector for the empty string", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
  });

  it("matches the FNV-1a 32-bit reference vector for 'a'", () => {
    expect(fnv1a32("a")).toBe(0xe40c292c);
  });
});
