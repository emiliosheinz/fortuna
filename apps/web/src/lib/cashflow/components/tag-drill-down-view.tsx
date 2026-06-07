"use client";

import { format, parseISO } from "date-fns";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTagDrillDown } from "../hooks";
import type { CategoryBucket, MonthBucket, Transaction } from "../types";
import { MonthRangePicker } from "./month-range-picker";

interface TagDrillDownViewProps {
  tagId: string;
  from: string | null;
  to: string | null;
  onWindowChange: (window: { from: string | null; to: string | null }) => void;
}

export function TagDrillDownView({
  tagId,
  from,
  to,
  onWindowChange,
}: TagDrillDownViewProps) {
  const rangeId = useId();
  const query = useTagDrillDown(tagId, {
    from: from ?? undefined,
    to: to ?? undefined,
  });

  return (
    <section className="flex flex-col gap-6" data-testid="tag-drill-down-view">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {query.data ? `# ${query.data.tag.name}` : "Tag drill-down"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Transactions tagged with this label, grouped by category and month.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={rangeId}>Window</Label>
          <MonthRangePicker
            id={rangeId}
            value={{ from, to }}
            data-testid="tag-drill-down-range-input"
            onChange={(next) => onWindowChange(next)}
          />
        </div>
      </div>

      {renderBody(query)}
    </section>
  );
}

function renderBody(
  query: ReturnType<typeof useTagDrillDown>,
): React.ReactElement {
  if (query.isPending) return <DrillDownSkeleton />;
  if (query.isError || !query.data) return <DrillDownError />;
  const { transactions, byCategory, byMonth, baseCurrency } = query.data;

  if (transactions.length === 0) {
    return (
      <p
        data-testid="tag-drill-down-empty"
        className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
      >
        No transactions linked to this tag in this window.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {query.data.excludedUnconvertibleCount > 0 ? (
        <p
          data-testid="tag-drill-down-unconvertible-note"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {query.data.excludedUnconvertibleCount} transaction
          {query.data.excludedUnconvertibleCount === 1 ? " is" : "s are"}{" "}
          excluded from these breakdowns because they have no FX path to{" "}
          {baseCurrency}.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CategoryBreakdown buckets={byCategory} baseCurrency={baseCurrency} />
        <MonthBreakdown points={byMonth} baseCurrency={baseCurrency} />
      </div>

      <TransactionsList transactions={transactions} />
    </div>
  );
}

function CategoryBreakdown({
  buckets,
  baseCurrency,
}: {
  buckets: CategoryBucket[];
  baseCurrency: string;
}) {
  return (
    <div
      data-testid="tag-drill-down-by-category"
      className="flex flex-col rounded-md border border-border"
    >
      <h2 className="border-b border-border px-3 py-2 text-sm font-medium">
        By category
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {buckets.map((bucket) => (
          <li
            key={bucket.categoryId ?? "__uncategorized__"}
            className="flex items-center justify-between p-3 text-sm"
          >
            <span>{bucket.categoryName ?? "Uncategorized"}</span>
            <span className="tabular-nums">
              {bucket.net} {baseCurrency}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthBreakdown({
  points,
  baseCurrency,
}: {
  points: MonthBucket[];
  baseCurrency: string;
}) {
  return (
    <div
      data-testid="tag-drill-down-by-month"
      className="flex flex-col rounded-md border border-border"
    >
      <h2 className="border-b border-border px-3 py-2 text-sm font-medium">
        By month
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {points.map((point) => (
          <li
            key={point.month}
            className="flex items-center justify-between p-3 text-sm"
          >
            <span>{format(parseISO(`${point.month}-01`), "LLL yyyy")}</span>
            <span className="tabular-nums">
              {point.net} {baseCurrency}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TransactionsList({ transactions }: { transactions: Transaction[] }) {
  return (
    <div
      data-testid="tag-drill-down-transactions"
      className="flex flex-col rounded-md border border-border"
    >
      <h2 className="border-b border-border px-3 py-2 text-sm font-medium">
        Transactions
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {transactions.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{row.description}</span>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(row.date), "PPP")}
              </span>
            </div>
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
          </li>
        ))}
      </ul>
    </div>
  );
}

function DrillDownSkeleton() {
  return (
    <div
      data-testid="tag-drill-down-loading"
      aria-busy="true"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function DrillDownError() {
  return (
    <p
      data-testid="tag-drill-down-error"
      role="alert"
      className="rounded-md border border-destructive/50 p-4 text-sm text-destructive"
    >
      Could not load the tag drill-down. Refresh and try again.
    </p>
  );
}
