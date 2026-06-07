"use client";

import { format, parseISO } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type TransactionFilters,
  useCategories,
  useTags,
  useTransactions,
} from "../hooks";
import type { Transaction } from "../types";
import { TransactionEditDialog } from "./transaction-edit-dialog";

interface TransactionListProps {
  filters?: TransactionFilters;
  frameless?: boolean;
}

export function TransactionList({
  filters,
  frameless = false,
}: TransactionListProps = {}) {
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions(filters);
  const categories = useCategories();
  const tags = useTags();
  const sentinelRef = useRef<HTMLLIElement | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

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

  const containerClass = frameless ? "" : "rounded-md border border-border";

  if (isPending) return <ListSkeleton frameless={frameless} />;

  if (isError) {
    return (
      <div
        role="alert"
        data-testid="transaction-list-error"
        className={`flex flex-col items-start gap-3 p-4 ${containerClass}`}
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
        className={
          frameless
            ? "p-6 text-center text-sm text-muted-foreground"
            : "rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
        }
      >
        No transactions yet. Capture one above.
      </p>
    );
  }

  const categoryNameById = new Map(
    (categories.data?.items ?? []).map((c) => [c.id, c.name]),
  );
  const tagNameById = new Map(
    (tags.data?.items ?? []).map((t) => [t.id, t.name]),
  );

  return (
    <>
      <ul
        data-testid="transaction-list"
        className={
          frameless
            ? "flex flex-col divide-y divide-border"
            : "flex flex-col divide-y divide-border rounded-md border border-border"
        }
      >
        {rows.map((row) => (
          <TransactionRow
            key={row.id}
            row={row}
            categoryName={
              row.categoryId ? categoryNameById.get(row.categoryId) : undefined
            }
            tagNames={row.tagIds
              .map((id) => tagNameById.get(id))
              .filter((n): n is string => Boolean(n))}
            onSelect={setEditing}
          />
        ))}
        {hasNextPage ? (
          <li
            ref={sentinelRef}
            data-testid="transaction-list-sentinel"
            className="p-2 text-center text-xs text-muted-foreground"
          >
            {isFetchingNextPage ? "Loading more…" : "Scroll to load more"}
          </li>
        ) : null}
      </ul>

      {editing ? (
        <TransactionEditDialog
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function TransactionRow({
  row,
  categoryName,
  tagNames,
  onSelect,
}: {
  row: Transaction;
  categoryName: string | undefined;
  tagNames: string[];
  onSelect: (row: Transaction) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-testid="transaction-row"
        onClick={() => onSelect(row)}
        className="flex w-full flex-col gap-1 p-3 text-left transition hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{row.description}</span>
          <span className="text-xs text-muted-foreground">
            {format(parseISO(row.date), "PPP")}
            {categoryName ? <> · {categoryName}</> : null}
          </span>
          {tagNames.length > 0 ? (
            <span className="flex flex-wrap gap-1 pt-1">
              {tagNames.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-1 self-start sm:items-end sm:self-auto">
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
          {row.unconvertible ? (
            <span
              data-testid="transaction-row-unconvertible-badge"
              title="No FX rate path to your base currency. The row is recorded but excluded from base-currency totals."
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
            >
              Unconvertible
            </span>
          ) : row.currency !== row.baseCurrency && row.baseAmount ? (
            <span
              data-testid="transaction-row-base-amount"
              className="text-xs text-muted-foreground"
            >
              ≈ {row.baseAmount} {row.baseCurrency}
              {row.rateSubstituted && row.rateDate ? (
                <span
                  data-testid="transaction-row-substituted-badge"
                  title={`Rate from ${row.rateDate} used because no rate was published on ${row.date}.`}
                  className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-900 dark:bg-sky-900/40 dark:text-sky-100"
                >
                  substituted
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

function ListSkeleton({ frameless }: { frameless: boolean }) {
  return (
    <div
      data-testid="transaction-list-loading"
      aria-busy="true"
      className={
        frameless
          ? "flex flex-col divide-y divide-border"
          : "flex flex-col divide-y divide-border rounded-md border border-border"
      }
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
