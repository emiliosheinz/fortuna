import type { TransactionKind } from "../entities/transaction.entity";
import type { PaletteKey } from "../tag-colors";

/**
 * A row already converted to the user's base currency. `tagIds` carries every
 * tag attached to the row (empty for untagged rows). `SummaryService` feeds
 * these into `aggregate()`, where an empty `tagIds` puts the row in the
 * synthetic `tagId: null` bucket. `TrendService` uses this shape but does
 * not call `aggregate()`; it always passes `tagIds: []`.
 */
export interface ConvertedRow {
  id: string;
  date: string;
  kind: TransactionKind;
  tagIds: string[];
  /** Base-currency value, decimal string. `null` when unconvertible. */
  baseAmount: string | null;
  unconvertible: boolean;
}

export interface BucketTotals {
  income: string;
  expense: string;
  net: string;
}

/**
 * Per-tag rollup bucket. `tagId === null` is the synthetic "no tags" bucket.
 *
 * Multi-count property: a row with `tagIds: [A, B]` contributes its full
 * amount to bucket `A` and bucket `B`, so `sum(byTag.expense)` is not
 * required to equal the period `totals.expense`. Callers must not treat
 * bucket amounts as a partition of the totals.
 */
export interface TagBucket extends BucketTotals {
  tagId: string | null;
  tagName: string | null;
  color: PaletteKey | null;
}

export interface TagInfo {
  name: string;
  color: PaletteKey;
}

export interface MonthBucket extends BucketTotals {
  month: string;
}

export interface AggregationResult {
  totals: BucketTotals;
  byTag: TagBucket[];
  byMonth: MonthBucket[];
  excludedUnconvertibleCount: number;
}

const ZERO = "0.00";
const NULL_TAG_KEY = "__null__";

/**
 * Aggregate converted rows into headline totals plus per-tag and per-month
 * buckets. Totals sum each row once; `byTag` multi-counts across every tag
 * on the row (see `TagBucket` JSDoc). A row with no tags contributes to the
 * synthetic `tagId: null` bucket. Sums run in JS numbers and are rounded
 * once at the response boundary.
 */
export function aggregate(
  rows: readonly ConvertedRow[],
  tagInfoById: ReadonlyMap<string, TagInfo>,
): AggregationResult {
  let income = 0;
  let expense = 0;
  let excludedUnconvertibleCount = 0;
  const tagBuckets = new Map<
    string,
    { income: number; expense: number; tagId: string | null }
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

    const keys: Array<{ key: string; tagId: string | null }> =
      row.tagIds.length === 0
        ? [{ key: NULL_TAG_KEY, tagId: null }]
        : row.tagIds.map((tagId) => ({ key: tagId, tagId }));

    for (const { key, tagId } of keys) {
      const bucket = tagBuckets.get(key) ?? {
        income: 0,
        expense: 0,
        tagId,
      };
      if (row.kind === "income") {
        bucket.income += value;
      } else {
        bucket.expense += value;
      }
      tagBuckets.set(key, bucket);
    }

    const monthKey = row.date.slice(0, 7);
    const month = monthBuckets.get(monthKey) ?? { income: 0, expense: 0 };
    if (row.kind === "income") {
      month.income += value;
    } else {
      month.expense += value;
    }
    monthBuckets.set(monthKey, month);
  }

  const byTag: TagBucket[] = [...tagBuckets.values()]
    .map((bucket) => {
      const info = bucket.tagId ? tagInfoById.get(bucket.tagId) : undefined;
      return {
        tagId: bucket.tagId,
        tagName: info?.name ?? null,
        color: info?.color ?? null,
        income: bucket.income.toFixed(2),
        expense: bucket.expense.toFixed(2),
        net: (bucket.income - bucket.expense).toFixed(2),
      };
    })
    .sort(compareTagBuckets);

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
    byTag,
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

function compareTagBuckets(a: TagBucket, b: TagBucket): number {
  if (a.tagId === null && b.tagId !== null) return 1;
  if (b.tagId === null && a.tagId !== null) return -1;
  const an = a.tagName ?? "";
  const bn = b.tagName ?? "";
  return an.localeCompare(bn);
}
