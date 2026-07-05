export type TransactionKind = "income" | "expense";

export interface TransactionGroup {
  id: string;
  position: number;
  size: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: string;
  currency: string;
  description: string;
  kind: TransactionKind;
  tagIds: string[];
  baseAmount: string | null;
  baseCurrency: string;
  rateSubstituted: boolean;
  rateDate: string | null;
  unconvertible: boolean;
  group: TransactionGroup | null;
  createdAt: string;
  updatedAt: string;
}

export interface BaseCurrencyResponse {
  baseCurrency: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface CreateTransactionInput {
  date: string;
  amount: string;
  currency: string;
  description: string;
  kind: TransactionKind;
  tagNames?: string[];
  installments?: { count: number };
}

export interface UpdateTransactionInput {
  date?: string;
  amount?: string;
  currency?: string;
  description?: string;
  kind?: TransactionKind;
  tagNames?: string[];
}

export interface ListTransactionsPage {
  items: Transaction[];
  nextCursor: string | null;
}

export interface ListTransactionsParams {
  cursor?: string;
  limit?: number;
  from?: string;
  to?: string;
  tagId?: string;
  groupId?: string;
  kind?: TransactionKind;
  q?: string;
}

/**
 * A bucket on the "by tag" rollup. A transaction with N tags contributes to
 * N buckets on its kind side; a transaction with no tags contributes to the
 * synthetic bucket with `tagId: null`. Buckets therefore do not sum to totals.
 */
export interface TagBucket {
  tagId: string | null;
  tagName: string | null;
  income: string;
  expense: string;
  net: string;
}

export interface MonthBucket {
  month: string;
  income: string;
  expense: string;
  net: string;
}

export interface SummaryResponse {
  month: string;
  baseCurrency: string;
  income: string;
  expense: string;
  net: string;
  byTag: TagBucket[];
  excludedUnconvertibleCount: number;
}

export interface TrendResponse {
  from: string;
  to: string;
  baseCurrency: string;
  points: MonthBucket[];
  excludedUnconvertibleCount: number;
}

export interface TagDrillDownResponse {
  tag: { id: string; name: string };
  baseCurrency: string;
  from: string | null;
  to: string | null;
  transactions: Transaction[];
  byMonth: MonthBucket[];
  excludedUnconvertibleCount: number;
}

export interface TrendParams {
  from?: string;
  to?: string;
}

export interface TagDrillDownParams {
  from?: string;
  to?: string;
}
