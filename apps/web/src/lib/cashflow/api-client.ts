import { apiClient } from "@/lib/api-client";
import type {
  BaseCurrencyResponse,
  CreateTransactionInput,
  ListTransactionsPage,
  ListTransactionsParams,
  Transaction,
} from "./types";

const PREFIX = "/api/v1";

function buildListUrl(params: ListTransactionsParams): string {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString();
  return `${PREFIX}/transactions${qs ? `?${qs}` : ""}`;
}

export const cashflowApi = {
  getBaseCurrency: () =>
    apiClient.get<BaseCurrencyResponse>(`${PREFIX}/users/me/base-currency`),

  setBaseCurrency: (baseCurrency: string) =>
    apiClient.put<BaseCurrencyResponse>(`${PREFIX}/users/me/base-currency`, {
      body: { baseCurrency },
    }),

  createTransaction: (input: CreateTransactionInput) =>
    apiClient.post<{ transaction: Transaction }>(`${PREFIX}/transactions`, {
      body: input,
    }),

  listTransactions: (params: ListTransactionsParams = {}) =>
    apiClient.get<ListTransactionsPage>(buildListUrl(params)),
};
