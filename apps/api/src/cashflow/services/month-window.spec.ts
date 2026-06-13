import { currentMonth, monthBounds, monthRangeBounds } from "./month-window";

describe("monthBounds", () => {
  it("returns inclusive bounds for the month", () => {
    expect(monthBounds("2026-02")).toEqual({
      firstDay: "2026-02-01",
      lastDay: "2026-02-28",
    });
  });

  it("handles leap-year February", () => {
    expect(monthBounds("2024-02")).toEqual({
      firstDay: "2024-02-01",
      lastDay: "2024-02-29",
    });
  });

  it("handles year-end months", () => {
    expect(monthBounds("2026-12")).toEqual({
      firstDay: "2026-12-01",
      lastDay: "2026-12-31",
    });
  });
});

describe("monthRangeBounds", () => {
  it("spans from first day of `from` to last day of `to`", () => {
    expect(monthRangeBounds("2025-11", "2026-02")).toEqual({
      firstDay: "2025-11-01",
      lastDay: "2026-02-28",
    });
  });
});

describe("currentMonth", () => {
  it("returns the YYYY-MM key for the date's UTC month", () => {
    expect(currentMonth(new Date(Date.UTC(2026, 5, 7)))).toBe("2026-06");
    expect(currentMonth(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01");
  });
});
