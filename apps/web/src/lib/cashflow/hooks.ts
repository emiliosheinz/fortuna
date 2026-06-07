"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { cashflowApi } from "./api-client";
import { CASHFLOW_QUERY_KEYS } from "./query-keys";
import type { CreateTransactionInput, ListTransactionsPage } from "./types";

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
    },
  });
}

export function useTransactions(limit = 50) {
  return useInfiniteQuery<ListTransactionsPage>({
    queryKey: [...CASHFLOW_QUERY_KEYS.transactions, { limit }],
    queryFn: ({ pageParam }) =>
      cashflowApi.listTransactions({
        cursor: pageParam as string | undefined,
        limit,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
