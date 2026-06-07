"use client";

import { format, parseISO } from "date-fns";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions } from "../hooks";
import type { Transaction } from "../types";

export function TransactionList() {
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) return <ListSkeleton />;

  if (isError) {
    return (
      <div
        role="alert"
        data-testid="transaction-list-error"
        className="flex flex-col items-start gap-3 rounded-md border border-border p-4"
      >
        <p className="text-sm text-muted-foreground">
          Could not load transactions.
        </p>
        <Button variant="outline" type="button" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const rows = data.pages.flatMap((page) => page.items);
  if (rows.length === 0) {
    return (
      <p
        data-testid="transaction-list-empty"
        className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
      >
        No transactions yet. Capture one above.
      </p>
    );
  }

  return (
    <ul
      data-testid="transaction-list"
      className="flex flex-col divide-y divide-border rounded-md border border-border"
    >
      {rows.map((row) => (
        <TransactionRow key={row.id} row={row} />
      ))}
      <li
        ref={sentinelRef}
        data-testid="transaction-list-sentinel"
        className="p-2 text-center text-xs text-muted-foreground"
      >
        {hasNextPage
          ? isFetchingNextPage
            ? "Loading more…"
            : "Scroll to load more"
          : null}
      </li>
    </ul>
  );
}

function TransactionRow({ row }: { row: Transaction }) {
  return (
    <li className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{row.description}</span>
        <span className="text-xs text-muted-foreground">
          {format(parseISO(row.date), "PPP")}
        </span>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <span
          className={
            row.kind === "expense"
              ? "text-sm font-semibold text-destructive"
              : "text-sm font-semibold text-emerald-600 dark:text-emerald-400"
          }
        >
          {row.kind === "expense" ? "-" : "+"}
          {row.amount} {row.currency}
        </span>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div
      data-testid="transaction-list-loading"
      aria-busy="true"
      className="flex flex-col divide-y divide-border rounded-md border border-border"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 p-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
