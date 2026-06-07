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

/**
 * Default trend window: the trailing 12 months ending in `now`'s month.
 * Both bounds inclusive.
 */
export function defaultTrendWindow(now: Date): { from: string; to: string } {
  const toYear = now.getUTCFullYear();
  const toMonth = now.getUTCMonth() + 1;
  const toKey = `${toYear}-${String(toMonth).padStart(2, "0")}`;
  const totalMonths = toYear * 12 + (toMonth - 1) - 11;
  const fromYear = Math.floor(totalMonths / 12);
  const fromMonth = (totalMonths % 12) + 1;
  const fromKey = `${fromYear}-${String(fromMonth).padStart(2, "0")}`;
  return { from: fromKey, to: toKey };
}

function lastDayIso(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthNum = Number(month.slice(5, 7));
  const day = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}
