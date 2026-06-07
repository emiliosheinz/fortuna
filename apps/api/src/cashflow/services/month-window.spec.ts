import {
  defaultTrendWindow,
  monthBounds,
  monthRangeBounds,
} from "./month-window";

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

describe("defaultTrendWindow", () => {
  it("returns the trailing twelve months ending in the current month", () => {
    const window = defaultTrendWindow(new Date(Date.UTC(2026, 5, 7)));
    expect(window).toEqual({ from: "2025-07", to: "2026-06" });
  });

  it("wraps year boundaries", () => {
    const window = defaultTrendWindow(new Date(Date.UTC(2026, 0, 15)));
    expect(window).toEqual({ from: "2025-02", to: "2026-01" });
  });
});
