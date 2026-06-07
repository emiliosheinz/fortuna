import { apiClient } from "@/lib/api-client";
import type {
  BaseCurrencyResponse,
  Category,
  CreateTransactionInput,
  ListTransactionsPage,
  ListTransactionsParams,
  SummaryResponse,
  Tag,
  TagDrillDownParams,
  TagDrillDownResponse,
  Transaction,
  TrendParams,
  TrendResponse,
  UpdateTransactionInput,
} from "./types";

const PREFIX = "/api/v1";

function buildListUrl(params: ListTransactionsParams): string {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.tagId) query.set("tagId", params.tagId);
  if (params.kind) query.set("kind", params.kind);
  if (params.q) query.set("q", params.q);
  const qs = query.toString();
  return `${PREFIX}/transactions${qs ? `?${qs}` : ""}`;
}

function buildTrendUrl(params: TrendParams): string {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const qs = query.toString();
  return `${PREFIX}/trend${qs ? `?${qs}` : ""}`;
}

function buildDrillDownUrl(tagId: string, params: TagDrillDownParams): string {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const qs = query.toString();
  return `${PREFIX}/tags/${tagId}/drill-down${qs ? `?${qs}` : ""}`;
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

  getSummary: (month: string) =>
    apiClient.get<SummaryResponse>(
      `${PREFIX}/summary?month=${encodeURIComponent(month)}`,
    ),

  getTrend: (params: TrendParams = {}) =>
    apiClient.get<TrendResponse>(buildTrendUrl(params)),

  getTagDrillDown: (tagId: string, params: TagDrillDownParams = {}) =>
    apiClient.get<TagDrillDownResponse>(buildDrillDownUrl(tagId, params)),
};
