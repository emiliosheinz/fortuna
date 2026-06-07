export interface MonthBounds {
  firstDay: string;
  lastDay: string;
}

/** Inclusive date bounds for a `YYYY-MM` month. */
export function monthBounds(month: string): MonthBounds {
  return monthRangeBounds(month, month);
}

/** Inclusive date bounds across the months `[from, to]`. */
export function monthRangeBounds(from: string, to: string): MonthBounds {
  return {
    firstDay: `${from}-01`,
    lastDay: lastDayIso(to),
  };
}

/** The `YYYY-MM` key for `now`'s UTC month. */
export function currentMonth(now: Date): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function lastDayIso(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  const day = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}
