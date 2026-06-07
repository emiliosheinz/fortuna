export type TransactionKind = "income" | "expense";

export interface Transaction {
  id: string;
  date: string;
  amount: string;
  currency: string;
  description: string;
  kind: TransactionKind;
  categoryId: string | null;
  tagIds: string[];
  baseAmount: string | null;
  baseCurrency: string;
  rateSubstituted: boolean;
  rateDate: string | null;
  unconvertible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BaseCurrencyResponse {
  baseCurrency: string;
}

export interface Category {
  id: string;
  name: string;
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
  categoryId?: string | null;
  tagNames?: string[];
}

export interface UpdateTransactionInput {
  date?: string;
  amount?: string;
  currency?: string;
  description?: string;
  kind?: TransactionKind;
  categoryId?: string | null;
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
  categoryId?: string;
  tagId?: string;
  kind?: TransactionKind;
  q?: string;
}

export interface CategoryBucket {
  categoryId: string | null;
  categoryName: string | null;
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
  byCategory: CategoryBucket[];
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
  byCategory: CategoryBucket[];
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
