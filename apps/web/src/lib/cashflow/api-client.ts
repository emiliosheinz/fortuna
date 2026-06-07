import { apiClient } from "@/lib/api-client";
import type {
  BaseCurrencyResponse,
  Category,
  CreateTransactionInput,
  ListTransactionsPage,
  ListTransactionsParams,
  Tag,
  Transaction,
  UpdateTransactionInput,
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

  updateTransaction: (id: string, input: UpdateTransactionInput) =>
    apiClient.patch<{ transaction: Transaction }>(
      `${PREFIX}/transactions/${id}`,
      {
        body: input,
      },
    ),

  deleteTransaction: (id: string) =>
    apiClient.delete<void>(`${PREFIX}/transactions/${id}`),

  listTransactions: (params: ListTransactionsParams = {}) =>
    apiClient.get<ListTransactionsPage>(buildListUrl(params)),

  listCategories: () =>
    apiClient.get<{ items: Category[] }>(`${PREFIX}/categories`),

  createCategory: (name: string) =>
    apiClient.post<{ category: Category }>(`${PREFIX}/categories`, {
      body: { name },
    }),

  renameCategory: (id: string, name: string) =>
    apiClient.patch<{ category: Category }>(`${PREFIX}/categories/${id}`, {
      body: { name },
    }),

  deleteCategory: (id: string) =>
    apiClient.delete<void>(`${PREFIX}/categories/${id}`),

  listTags: () => apiClient.get<{ items: Tag[] }>(`${PREFIX}/tags`),

  createTag: (name: string) =>
    apiClient.post<{ tag: Tag }>(`${PREFIX}/tags`, {
      body: { name },
    }),

  renameTag: (id: string, name: string) =>
    apiClient.patch<{ tag: Tag }>(`${PREFIX}/tags/${id}`, {
      body: { name },
    }),

  deleteTag: (id: string) => apiClient.delete<void>(`${PREFIX}/tags/${id}`),
};
