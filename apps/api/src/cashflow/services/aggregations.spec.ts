import {
  aggregate,
  type ConvertedRow,
  enumerateMonths,
  type TagInfo,
} from "./aggregations";

const FOOD = "11111111-1111-1111-1111-111111111111";
const TRANSPORT = "22222222-2222-2222-2222-222222222222";

function row(overrides: Partial<ConvertedRow>): ConvertedRow {
  return {
    id: "row",
    date: "2026-06-07",
    kind: "expense",
    tagIds: [],
    baseAmount: "10.00",
    unconvertible: false,
    ...overrides,
  };
}

const TAG_INFO = new Map<string, TagInfo>([
  [FOOD, { name: "Food", color: "emerald" }],
  [TRANSPORT, { name: "Transport", color: "sky" }],
]);

describe("aggregate", () => {
  it("rolls up income, expense, and net in two-decimal strings", () => {
    const result = aggregate(
      [
        row({ id: "a", kind: "income", baseAmount: "1234.50" }),
        row({ id: "b", kind: "expense", baseAmount: "200.25" }),
        row({ id: "c", kind: "expense", baseAmount: "99.99" }),
      ],
      new Map(),
    );
    expect(result.totals).toEqual({
      income: "1234.50",
      expense: "300.24",
      net: "934.26",
    });
  });

  it("groups by tagId, resolving names and colors, sorting named alphabetical with the null-tag bucket last", () => {
    const result = aggregate(
      [
        row({ id: "a", tagIds: [FOOD], baseAmount: "30.00" }),
        row({ id: "b", tagIds: [FOOD], baseAmount: "20.00" }),
        row({ id: "c", tagIds: [TRANSPORT], baseAmount: "15.00" }),
        row({ id: "d", tagIds: [], baseAmount: "5.00" }),
      ],
      TAG_INFO,
    );

    expect(result.byTag).toEqual([
      {
        tagId: FOOD,
        tagName: "Food",
        color: "emerald",
        income: "0.00",
        expense: "50.00",
        net: "-50.00",
      },
      {
        tagId: TRANSPORT,
        tagName: "Transport",
        color: "sky",
        income: "0.00",
        expense: "15.00",
        net: "-15.00",
      },
      {
        tagId: null,
        tagName: null,
        color: null,
        income: "0.00",
        expense: "5.00",
        net: "-5.00",
      },
    ]);
  });

  it("multi-counts a row across every tag it carries so bucket sums exceed the totals", () => {
    const result = aggregate(
      [row({ id: "a", tagIds: [FOOD, TRANSPORT], baseAmount: "100.00" })],
      TAG_INFO,
    );

    const foodBucket = result.byTag.find((b) => b.tagId === FOOD);
    const transportBucket = result.byTag.find((b) => b.tagId === TRANSPORT);
    expect(foodBucket?.expense).toBe("100.00");
    expect(transportBucket?.expense).toBe("100.00");
    expect(result.totals.expense).toBe("100.00");

    const bucketSum =
      Number(foodBucket?.expense) + Number(transportBucket?.expense);
    expect(bucketSum).toBeGreaterThan(Number(result.totals.expense));
  });

  it("routes a tagless row into a single synthetic null-tag bucket with null color", () => {
    const result = aggregate(
      [row({ id: "a", tagIds: [], baseAmount: "42.00" })],
      new Map(),
    );

    expect(result.byTag).toEqual([
      {
        tagId: null,
        tagName: null,
        color: null,
        income: "0.00",
        expense: "42.00",
        net: "-42.00",
      },
    ]);
  });

  it("emits null color when the tag id is unknown to the tagInfoById map", () => {
    const result = aggregate(
      [row({ id: "a", tagIds: [FOOD], baseAmount: "10.00" })],
      new Map(),
    );
    expect(result.byTag[0]?.color).toBeNull();
    expect(result.byTag[0]?.tagName).toBeNull();
  });

  it("excludes unconvertible rows from totals and reports the count", () => {
    const result = aggregate(
      [
        row({ id: "a", baseAmount: "10.00" }),
        row({ id: "b", baseAmount: null, unconvertible: true }),
        row({ id: "c", baseAmount: null, unconvertible: true }),
      ],
      new Map(),
    );
    expect(result.totals).toEqual({
      income: "0.00",
      expense: "10.00",
      net: "-10.00",
    });
    expect(result.excludedUnconvertibleCount).toBe(2);
  });

  it("buckets by month using the date's YYYY-MM prefix", () => {
    const result = aggregate(
      [
        row({ id: "a", date: "2026-05-15", baseAmount: "20.00" }),
        row({ id: "b", date: "2026-05-30", baseAmount: "10.00" }),
        row({ id: "c", date: "2026-06-01", baseAmount: "5.00" }),
      ],
      new Map(),
    );
    expect(result.byMonth).toEqual([
      { month: "2026-05", income: "0.00", expense: "30.00", net: "-30.00" },
      { month: "2026-06", income: "0.00", expense: "5.00", net: "-5.00" },
    ]);
  });
});

describe("enumerateMonths", () => {
  it("includes both endpoints and wraps year boundaries", () => {
    expect(enumerateMonths("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns a single month when from === to", () => {
    expect(enumerateMonths("2026-06", "2026-06")).toEqual(["2026-06"]);
  });
});
