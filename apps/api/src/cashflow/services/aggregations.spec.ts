import { aggregate, type ConvertedRow, enumerateMonths } from "./aggregations";

const FOOD = "11111111-1111-1111-1111-111111111111";
const TRANSPORT = "22222222-2222-2222-2222-222222222222";

function row(overrides: Partial<ConvertedRow>): ConvertedRow {
  return {
    id: "row",
    date: "2026-06-07",
    kind: "expense",
    categoryId: null,
    baseAmount: "10.00",
    unconvertible: false,
    ...overrides,
  };
}

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

  it("groups by categoryId, treating null as its own bucket and resolving names", () => {
    const result = aggregate(
      [
        row({ id: "a", categoryId: FOOD, baseAmount: "30.00" }),
        row({ id: "b", categoryId: FOOD, baseAmount: "20.00" }),
        row({ id: "c", categoryId: TRANSPORT, baseAmount: "15.00" }),
        row({ id: "d", categoryId: null, baseAmount: "5.00" }),
      ],
      new Map([
        [FOOD, "Food"],
        [TRANSPORT, "Transport"],
      ]),
    );

    expect(result.byCategory).toEqual([
      {
        categoryId: FOOD,
        categoryName: "Food",
        income: "0.00",
        expense: "50.00",
        net: "-50.00",
      },
      {
        categoryId: TRANSPORT,
        categoryName: "Transport",
        income: "0.00",
        expense: "15.00",
        net: "-15.00",
      },
      {
        categoryId: null,
        categoryName: null,
        income: "0.00",
        expense: "5.00",
        net: "-5.00",
      },
    ]);
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
