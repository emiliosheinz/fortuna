"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { cashflowApi } from "./api-client";
import { CASHFLOW_QUERY_KEYS } from "./query-keys";
import type {
  CreateTransactionInput,
  ListTransactionsPage,
  ListTransactionsParams,
  TagDrillDownParams,
  TrendParams,
  UpdateTransactionInput,
} from "./types";

export function useBaseCurrency() {
  return useQuery({
    queryKey: CASHFLOW_QUERY_KEYS.baseCurrency,
    queryFn: () => cashflowApi.getBaseCurrency(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSetBaseCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (baseCurrency: string) =>
      cashflowApi.setBaseCurrency(baseCurrency),
    onSuccess: (data) => {
      queryClient.setQueryData(CASHFLOW_QUERY_KEYS.baseCurrency, data);
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      cashflowApi.createTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.transactions,
      });
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.tags,
      });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateTransactionInput;
    }) => cashflowApi.updateTransaction(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.transactions,
      });
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.tags,
      });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cashflowApi.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.transactions,
      });
    },
  });
}

export type TransactionFilters = Omit<
  ListTransactionsParams,
  "cursor" | "limit"
>;

export function useTransactions(filters: TransactionFilters = {}, limit = 50) {
  return useInfiniteQuery<ListTransactionsPage>({
    queryKey: [...CASHFLOW_QUERY_KEYS.transactions, { ...filters, limit }],
    queryFn: ({ pageParam }) =>
      cashflowApi.listTransactions({
        cursor: pageParam as string | undefined,
        limit,
        ...filters,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: CASHFLOW_QUERY_KEYS.categories,
    queryFn: () => cashflowApi.listCategories(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => cashflowApi.createCategory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.categories,
      });
    },
  });
}

export function useRenameCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      cashflowApi.renameCategory(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.categories,
      });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cashflowApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.categories,
      });
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.transactions,
      });
    },
  });
}

export function useTags() {
  return useQuery({
    queryKey: CASHFLOW_QUERY_KEYS.tags,
    queryFn: () => cashflowApi.listTags(),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => cashflowApi.createTag(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASHFLOW_QUERY_KEYS.tags });
    },
  });
}

export function useRenameTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      cashflowApi.renameTag(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASHFLOW_QUERY_KEYS.tags });
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.transactions,
      });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cashflowApi.deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASHFLOW_QUERY_KEYS.tags });
      queryClient.invalidateQueries({
        queryKey: CASHFLOW_QUERY_KEYS.transactions,
      });
    },
  });
}

export function useSummary(month: string) {
  return useQuery({
    queryKey: [...CASHFLOW_QUERY_KEYS.summary, month],
    queryFn: () => cashflowApi.getSummary(month),
  });
}

export function useTrend(params: TrendParams = {}) {
  return useQuery({
    queryKey: [...CASHFLOW_QUERY_KEYS.trend, params],
    queryFn: () => cashflowApi.getTrend(params),
  });
}

export function useTagDrillDown(
  tagId: string,
  params: TagDrillDownParams = {},
) {
  return useQuery({
    queryKey: [...CASHFLOW_QUERY_KEYS.tagDrillDown, tagId, params],
    queryFn: () => cashflowApi.getTagDrillDown(tagId, params),
    enabled: Boolean(tagId),
  });
}
