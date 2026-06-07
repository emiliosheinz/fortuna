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
}
