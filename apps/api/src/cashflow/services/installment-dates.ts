const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Generate `count` ISO date strings spaced one calendar month apart,
 * starting at `start`. When the source day-of-month does not exist in a
 * target month (e.g. Jan 31 → Feb), the date clamps to that month's last
 * valid day. The original day-of-month is preserved as the anchor for
 * subsequent steps so clamping never permanently shifts the cadence.
 */
export function generateInstallmentDates(
  start: string,
  count: number,
): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("installments count must be a positive integer");
  }
  if (!ISO_DATE_RE.test(start)) {
    throw new Error("start must be YYYY-MM-DD");
  }

  const [yearStr, monthStr, dayStr] = start.split("-");
  const startYear = Number(yearStr);
  const startMonth = Number(monthStr);
  const anchorDay = Number(dayStr);

  if (!isValidGregorian(startYear, startMonth, anchorDay)) {
    throw new Error("start must be a valid Gregorian date");
  }

  const dates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const totalMonths = startMonth - 1 + i;
    const targetYear = startYear + Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1;
    const daysInMonth = lastDayOfMonth(targetYear, targetMonth);
    const day = Math.min(anchorDay, daysInMonth);
    dates.push(format(targetYear, targetMonth, day));
  }
  return dates;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidGregorian(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > lastDayOfMonth(year, month)) return false;
  return true;
}

function format(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
