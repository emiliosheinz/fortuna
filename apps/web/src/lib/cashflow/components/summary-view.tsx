"use client";

import { format, parseISO } from "date-fns";
import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSummary } from "../hooks";
import type { CategoryBucket } from "../types";
import { MonthPicker } from "./month-picker";

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

const SUMMARY_CHART_CONFIG = {
  expense: {
    label: "Expense",
    color: "var(--chart-1)",
  },
  income: {
    label: "Income",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function CategoryBreakdown({
  buckets,
  baseCurrency,
}: {
  buckets: CategoryBucket[];
  baseCurrency: string;
}) {
  const hasIncome = buckets.some((b) => Number(b.income) > 0);
  const chartData = buckets.map((bucket) => ({
    category: bucket.categoryName ?? "Uncategorized",
    expense: Number(bucket.expense),
    income: Number(bucket.income),
  }));
  return (
    <div
      data-testid="summary-by-category"
      className="flex flex-col gap-2 rounded-md border border-border"
    >
      <h2 className="border-b border-border px-3 py-2 text-sm font-medium">
        By category
      </h2>
      <ChartContainer
        config={SUMMARY_CHART_CONFIG}
        className="aspect-auto h-72 w-full px-2 sm:px-4"
      >
        <BarChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 12, right: 12, top: 12 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="category"
            tickLine={false}
            tickMargin={8}
            axisLine={false}
            interval={0}
            tickFormatter={(label: string) =>
              label.length > 12 ? `${label.slice(0, 12)}…` : label
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatChartTick(value)}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                formatter={(value, name) => (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {SUMMARY_CHART_CONFIG[
                        name as keyof typeof SUMMARY_CHART_CONFIG
                      ]?.label ?? name}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {Number(value).toFixed(2)} {baseCurrency}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="expense"
            fill="var(--color-expense)"
            radius={[4, 4, 0, 0]}
          />
          {hasIncome ? (
            <Bar
              dataKey="income"
              fill="var(--color-income)"
              radius={[4, 4, 0, 0]}
            />
          ) : null}
        </BarChart>
      </ChartContainer>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {buckets.map((bucket) => (
          <CategoryRow
            key={bucket.categoryId ?? "__uncategorized__"}
            bucket={bucket}
            baseCurrency={baseCurrency}
          />
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({
  bucket,
  baseCurrency,
}: {
  bucket: CategoryBucket;
  baseCurrency: string;
}) {
  return (
    <li
      data-testid="summary-category-row"
      className="flex items-center justify-between gap-4 px-3 py-2"
    >
      <span className="text-sm">{bucket.categoryName ?? "Uncategorized"}</span>
      <div className="flex flex-col text-right text-xs text-muted-foreground">
        <span
          data-testid="summary-category-net"
          className="text-sm font-semibold text-foreground tabular-nums"
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

function formatChartTick(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
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
