import { generateInstallmentDates } from "./installment-dates";

describe("generateInstallmentDates", () => {
  it("returns a single date for count = 1", () => {
    expect(generateInstallmentDates("2026-06-07", 1)).toEqual(["2026-06-07"]);
  });

  it("spaces dates one calendar month apart for a mid-month start", () => {
    expect(generateInstallmentDates("2026-01-15", 4)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  it("clamps end-of-month source dates to the target month's last day", () => {
    expect(generateInstallmentDates("2026-01-31", 4)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("handles February in a leap year", () => {
    expect(generateInstallmentDates("2024-01-31", 3)).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
    ]);
  });

  it("crosses a year boundary", () => {
    expect(generateInstallmentDates("2026-11-30", 3)).toEqual([
      "2026-11-30",
      "2026-12-30",
      "2027-01-30",
    ]);
  });

  it("throws when count is below one", () => {
    expect(() => generateInstallmentDates("2026-01-15", 0)).toThrow();
    expect(() => generateInstallmentDates("2026-01-15", -3)).toThrow();
  });

  it("throws when the start date is malformed", () => {
    expect(() => generateInstallmentDates("not-a-date", 3)).toThrow();
  });
});
