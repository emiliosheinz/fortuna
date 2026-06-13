const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mirror of the API's installment date generator (see
 * `apps/api/src/cashflow/services/installment-dates.ts`) for the
 * capture-form preview. Kept in sync by behaviour, not import — the web
 * app cannot reach into the API workspace.
 */
export function generateInstallmentDates(
  start: string,
  count: number,
): string[] {
  if (!Number.isInteger(count) || count < 1) return [];
  if (!ISO_DATE_RE.test(start)) return [];

  const [yearStr, monthStr, dayStr] = start.split("-");
  const startYear = Number(yearStr);
  const startMonth = Number(monthStr);
  const anchorDay = Number(dayStr);

  const dates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const totalMonths = startMonth - 1 + i;
    const targetYear = startYear + Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1;
    const daysInMonth = new Date(
      Date.UTC(targetYear, targetMonth, 0),
    ).getUTCDate();
    const day = Math.min(anchorDay, daysInMonth);
    dates.push(`${pad(targetYear, 4)}-${pad(targetMonth, 2)}-${pad(day, 2)}`);
  }
  return dates;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
