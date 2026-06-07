export type TransactionKind = "income" | "expense";

export interface Transaction {
  id: string;
  date: string;
  amount: string;
  currency: string;
  description: string;
  kind: TransactionKind;
  createdAt: string;
  updatedAt: string;
}

export interface BaseCurrencyResponse {
  baseCurrency: string;
}

export interface CreateTransactionInput {
  date: string;
  amount: string;
  currency: string;
  description: string;
  kind: TransactionKind;
}

export interface ListTransactionsPage {
  items: Transaction[];
  nextCursor: string | null;
}

export interface ListTransactionsParams {
  cursor?: string;
  limit?: number;
}
