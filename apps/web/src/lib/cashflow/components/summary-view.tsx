"use client";

import { format, parseISO } from "date-fns";
import { useId, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "../format-money";
import { useSummary } from "../hooks";
import type { TagBucket } from "../types";
import { MonthPicker } from "./month-picker";
import { TagPie, tagColor } from "./tag-pie";

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
          <MonthPicker
            id={monthInputId}
            value={month}
            data-testid="summary-month-input"
            onChange={(next) => {
              if (next) onMonthChange(next);
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
    data.byTag.length === 0;

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
        <TagBreakdown buckets={data.byTag} baseCurrency={data.baseCurrency} />
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
        currency={baseCurrency}
        tone="positive"
      />
      <Total
        label="Expense"
        value={expense}
        currency={baseCurrency}
        tone="negative"
      />
      <Total label="Net" value={net} currency={baseCurrency} tone="neutral" />
    </dl>
  );
}

function Total({
  label,
  value,
  currency,
  tone,
}: {
  label: string;
  value: string;
  currency: string;
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
        {formatMoney(value, currency)}
      </dd>
    </div>
  );
}

function TagBreakdown({
  buckets,
  baseCurrency,
}: {
  buckets: TagBucket[];
  baseCurrency: string;
}) {
  const expenseBuckets = useMemo(
    () => buckets.filter((b) => Number(b.expense) > 0),
    [buckets],
  );

  return (
    <div
      data-testid="summary-by-tag"
      className="flex flex-col gap-2 rounded-md border border-border"
    >
      <h2 className="border-b border-border px-3 py-2 text-sm font-medium">
        By tag
      </h2>
      {expenseBuckets.length === 0 ? (
        <p
          data-testid="summary-by-tag-empty"
          className="px-3 py-6 text-center text-sm text-muted-foreground"
        >
          No expenses this month.
        </p>
      ) : (
        <TagPie buckets={expenseBuckets} baseCurrency={baseCurrency} />
      )}
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {expenseBuckets.map((bucket, index) => (
          <TagRow
            key={bucket.tagId ?? "__untagged__"}
            bucket={bucket}
            baseCurrency={baseCurrency}
            color={tagColor(index)}
          />
        ))}
      </ul>
    </div>
  );
}

function TagRow({
  bucket,
  baseCurrency,
  color,
}: {
  bucket: TagBucket;
  baseCurrency: string;
  color: string;
}) {
  return (
    <li
      data-testid="summary-tag-row"
      className="flex items-center justify-between gap-4 px-3 py-2"
    >
      <span className="flex items-center gap-2 text-sm">
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ background: color }}
        />
        {bucket.tagName ?? "Untagged"}
      </span>
      <span
        data-testid="summary-tag-net"
        className="text-sm font-semibold text-foreground tabular-nums"
      >
        {formatMoney(`-${bucket.expense}`, baseCurrency)}
      </span>
    </li>
  );
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
