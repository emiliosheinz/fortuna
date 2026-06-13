import type { TransactionKind } from "../entities/transaction.entity";

/** A row already converted to the user's base currency. */
export interface ConvertedRow {
  id: string;
  date: string;
  kind: TransactionKind;
  categoryId: string | null;
  /** Base-currency value, decimal string. `null` when unconvertible. */
  baseAmount: string | null;
  unconvertible: boolean;
}

export interface BucketTotals {
  income: string;
  expense: string;
  net: string;
}

export interface CategoryBucket extends BucketTotals {
  categoryId: string | null;
  categoryName: string | null;
}

export interface MonthBucket extends BucketTotals {
  month: string;
}

export interface AggregationResult {
  totals: BucketTotals;
  byCategory: CategoryBucket[];
  byMonth: MonthBucket[];
  excludedUnconvertibleCount: number;
}

const ZERO = "0.00";

/**
 * Aggregate converted rows into headline totals plus per-category and per-month
 * buckets. The caller decides which slices to expose. Sums run in JS numbers and
 * are rounded once at the response boundary.
 */
export function aggregate(
  rows: readonly ConvertedRow[],
  categoryNameById: ReadonlyMap<string, string>,
): AggregationResult {
  let income = 0;
  let expense = 0;
  let excludedUnconvertibleCount = 0;
  const categoryBuckets = new Map<
    string,
    { income: number; expense: number; categoryId: string | null }
  >();
  const monthBuckets = new Map<string, { income: number; expense: number }>();

  for (const row of rows) {
    if (row.unconvertible || row.baseAmount === null) {
      excludedUnconvertibleCount += 1;
      continue;
    }
    const value = Number(row.baseAmount);
    if (!Number.isFinite(value)) {
      excludedUnconvertibleCount += 1;
      continue;
    }
    if (row.kind === "income") {
      income += value;
    } else {
      expense += value;
    }

    const categoryKey = row.categoryId ?? "__null__";
    const category = categoryBuckets.get(categoryKey) ?? {
      income: 0,
      expense: 0,
      categoryId: row.categoryId,
    };
    if (row.kind === "income") {
      category.income += value;
    } else {
      category.expense += value;
    }
    categoryBuckets.set(categoryKey, category);

    const monthKey = row.date.slice(0, 7);
    const month = monthBuckets.get(monthKey) ?? { income: 0, expense: 0 };
    if (row.kind === "income") {
      month.income += value;
    } else {
      month.expense += value;
    }
    monthBuckets.set(monthKey, month);
  }

  const byCategory: CategoryBucket[] = [...categoryBuckets.values()]
    .map((bucket) => ({
      categoryId: bucket.categoryId,
      categoryName: bucket.categoryId
        ? (categoryNameById.get(bucket.categoryId) ?? null)
        : null,
      income: bucket.income.toFixed(2),
      expense: bucket.expense.toFixed(2),
      net: (bucket.income - bucket.expense).toFixed(2),
    }))
    .sort(compareCategoryBuckets);

  const byMonth: MonthBucket[] = [...monthBuckets.entries()]
    .map(([month, bucket]) => ({
      month,
      income: bucket.income.toFixed(2),
      expense: bucket.expense.toFixed(2),
      net: (bucket.income - bucket.expense).toFixed(2),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totals: {
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      net: (income - expense).toFixed(2),
    },
    byCategory,
    byMonth,
    excludedUnconvertibleCount,
  };
}

/** Zero-filled totals, for endpoints that should return a stable shape on an empty result. */
export function emptyTotals(): BucketTotals {
  return { income: ZERO, expense: ZERO, net: ZERO };
}

/** Generate a list of YYYY-MM keys from `from` (inclusive) to `to` (inclusive). */
export function enumerateMonths(from: string, to: string): string[] {
  const fromYear = Number(from.slice(0, 4));
  const fromMonth = Number(from.slice(5, 7));
  const toYear = Number(to.slice(0, 4));
  const toMonth = Number(to.slice(5, 7));
  const out: string[] = [];
  let year = fromYear;
  let month = fromMonth;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function compareCategoryBuckets(a: CategoryBucket, b: CategoryBucket): number {
  if (a.categoryId === null && b.categoryId !== null) return 1;
  if (b.categoryId === null && a.categoryId !== null) return -1;
  const an = a.categoryName ?? "";
  const bn = b.categoryName ?? "";
  return an.localeCompare(bn);
}
