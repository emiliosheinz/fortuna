"use client";

import { format, parseISO } from "date-fns";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSummary } from "../hooks";
import type { CategoryBucket } from "../types";

interface SummaryViewProps {
  month: string;
  onMonthChange: (next: string) => void;
}

function formatMonthLabel(month: string): string {
  return format(parseISO(`${month}-01`), "LLLL yyyy");
}

export function SummaryView({ month, onMonthChange }: SummaryViewProps) {
  const monthInputId = useId();
  const query = useSummary(month);

  return (
    <section className="flex flex-col gap-6" data-testid="summary-view">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Monthly summary</h1>
          <p className="text-sm text-muted-foreground">
            {formatMonthLabel(month)} totals rolled up into your base currency.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={monthInputId}>Month</Label>
          <Input
            id={monthInputId}
            type="month"
            value={month}
            data-testid="summary-month-input"
            onChange={(e) => {
              if (e.target.value) onMonthChange(e.target.value);
            }}
          />
        </div>
      </div>

      {renderBody(query, month)}
    </section>
  );
}

function renderBody(
  query: ReturnType<typeof useSummary>,
  month: string,
): React.ReactElement {
  if (query.isPending) return <SummarySkeleton />;
  if (query.isError) return <SummaryError />;
  return <SummaryContent data={query.data} fallbackMonth={month} />;
}

function SummaryContent({
  data,
  fallbackMonth,
}: {
  data: ReturnType<typeof useSummary>["data"];
  fallbackMonth: string;
}) {
  if (!data) {
    return <SummaryError />;
  }
  const isEmpty =
    data.income === "0.00" &&
    data.expense === "0.00" &&
    data.byCategory.length === 0;

  return (
    <>
      <Totals
        income={data.income}
        expense={data.expense}
        net={data.net}
        baseCurrency={data.baseCurrency}
        month={data.month ?? fallbackMonth}
      />
      {data.excludedUnconvertibleCount > 0 ? (
        <p
          data-testid="summary-unconvertible-note"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {data.excludedUnconvertibleCount} transaction
          {data.excludedUnconvertibleCount === 1 ? " is" : "s are"} excluded
          from these totals because they have no FX path to {data.baseCurrency}.
        </p>
      ) : null}
      {isEmpty ? (
        <p
          data-testid="summary-empty"
          className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
        >
          No transactions for this month yet.
        </p>
      ) : (
        <CategoryBreakdown
          buckets={data.byCategory}
          baseCurrency={data.baseCurrency}
        />
      )}
    </>
  );
}

function Totals({
  income,
  expense,
  net,
  baseCurrency,
  month,
}: {
  income: string;
  expense: string;
  net: string;
  baseCurrency: string;
  month: string;
}) {
  return (
    <dl
      data-testid="summary-totals"
      data-month={month}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      <Total
        label="Income"
        value={income}
        unit={baseCurrency}
        tone="positive"
      />
      <Total
        label="Expense"
        value={expense}
        unit={baseCurrency}
        tone="negative"
      />
      <Total label="Net" value={net} unit={baseCurrency} tone="neutral" />
    </dl>
  );
}

function Total({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div
      data-testid={`summary-total-${label.toLowerCase()}`}
      className="flex flex-col gap-1 rounded-md border border-border p-3"
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`text-xl font-semibold ${valueClass}`}>
        {value} <span className="text-sm font-normal">{unit}</span>
      </dd>
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
  const max = buckets.reduce((acc, b) => Math.max(acc, magnitude(b)), 0) || 1;
  return (
    <div
      data-testid="summary-by-category"
      className="flex flex-col gap-2 rounded-md border border-border"
    >
      <h2 className="border-b border-border px-3 py-2 text-sm font-medium">
        By category
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {buckets.map((bucket) => (
          <CategoryRow
            key={bucket.categoryId ?? "__uncategorized__"}
            bucket={bucket}
            max={max}
            baseCurrency={baseCurrency}
          />
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({
  bucket,
  max,
  baseCurrency,
}: {
  bucket: CategoryBucket;
  max: number;
  baseCurrency: string;
}) {
  const value = magnitude(bucket);
  const percent = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <li
      data-testid="summary-category-row"
      className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <span className="text-sm font-medium sm:basis-40">
        {bucket.categoryName ?? "Uncategorized"}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-foreground/70"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-col text-right text-xs text-muted-foreground sm:basis-40">
        <span
          data-testid="summary-category-net"
          className="text-sm font-semibold text-foreground"
        >
          {bucket.net} {baseCurrency}
        </span>
        <span>
          +{bucket.income} / -{bucket.expense}
        </span>
      </div>
    </li>
  );
}

function magnitude(bucket: CategoryBucket): number {
  return Math.abs(Number(bucket.net));
}

function SummarySkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="summary-loading"
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function SummaryError() {
  return (
    <p
      role="alert"
      data-testid="summary-error"
      className="rounded-md border border-destructive/50 p-4 text-sm text-destructive"
    >
      Could not load the summary. Refresh and try again.
    </p>
  );
}
