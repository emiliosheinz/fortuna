import type { TagBucket } from "../../types";
import { computeTagPieSlices } from "../tag-pie";

function bucket(overrides: Partial<TagBucket>): TagBucket {
  return {
    tagId: "t",
    tagName: "T",
    color: "amber",
    income: "0.00",
    expense: "10.00",
    net: "-10.00",
    ...overrides,
  };
}

describe("computeTagPieSlices", () => {
  it("maps real-tag buckets to var(--tag-color-<key>) and the Untagged bucket to var(--muted-foreground)", () => {
    const slices = computeTagPieSlices([
      bucket({
        tagId: "a",
        tagName: "Food",
        color: "emerald",
        expense: "30.00",
      }),
      bucket({ tagId: "b", tagName: "Rent", color: "rose", expense: "20.00" }),
      bucket({ tagId: null, tagName: null, color: null, expense: "5.00" }),
    ]);
    expect(slices).toEqual([
      { key: "a", name: "Food", value: 30, color: "var(--tag-color-emerald)" },
      { key: "b", name: "Rent", value: 20, color: "var(--tag-color-rose)" },
      {
        key: "__untagged__",
        name: "Untagged",
        value: 5,
        color: "var(--muted-foreground)",
      },
    ]);
  });
});
