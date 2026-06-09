"use client";

import { format, parseISO } from "date-fns";
import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "../format-money";
import { useTrend } from "../hooks";
import type { MonthBucket } from "../types";
import { MonthRangePicker } from "./month-range-picker";

interface TrendViewProps {
  from: string | null;
  to: string | null;
  onWindowChange: (window: { from: string | null; to: string | null }) => void;
}

export function TrendView({ from, to, onWindowChange }: TrendViewProps) {
  const rangeId = useId();
  const query = useTrend({ from: from ?? undefined, to: to ?? undefined });

  return (
    <section className="flex flex-col gap-6" data-testid="trend-view">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Cash-flow trend</h1>
          <p className="text-sm text-muted-foreground">
            Per-month income, expense, and net in your base currency.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={rangeId}>Window</Label>
          <MonthRangePicker
            id={rangeId}
            value={{ from, to }}
            data-testid="trend-range-input"
            onChange={(next) => onWindowChange(next)}
          />
        </div>
      </div>

      {renderBody(query)}
    </section>
  );
}

function renderBody(query: ReturnType<typeof useTrend>): React.ReactElement {
  if (query.isPending) return <TrendSkeleton />;
  if (query.isError) return <TrendError />;
  if (!query.data) return <TrendError />;

  const isEmpty = query.data.points.every(
    (p) => p.income === "0.00" && p.expense === "0.00",
  );
  return (
    <div className="flex flex-col gap-4">
      {query.data.excludedUnconvertibleCount > 0 ? (
        <p
          data-testid="trend-unconvertible-note"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {query.data.excludedUnconvertibleCount} transaction
          {query.data.excludedUnconvertibleCount === 1 ? " is" : "s are"}{" "}
          excluded from these points because they have no FX path to{" "}
          {query.data.baseCurrency}.
        </p>
      ) : null}

      {isEmpty ? (
        <p
          data-testid="trend-empty"
          className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
        >
          No transactions in this window.
        </p>
      ) : (
        <TrendChart
          points={query.data.points}
          baseCurrency={query.data.baseCurrency}
        />
      )}
    </div>
  );
}

const TREND_CHART_CONFIG = {
  income: { label: "Income", color: "var(--chart-2)" },
  expense: { label: "Expense", color: "var(--chart-1)" },
  net: { label: "Net", color: "var(--chart-3)" },
} satisfies ChartConfig;

function TrendChart({
  points,
  baseCurrency,
}: {
  points: MonthBucket[];
  baseCurrency: string;
}) {
  const chartData = points.map((p) => ({
    month: p.month,
    income: Number(p.income),
    expense: Number(p.expense),
    net: Number(p.net),
  }));
  return (
    <div
      data-testid="trend-chart"
      className="flex flex-col gap-2 rounded-md border border-border p-3"
    >
      <ChartContainer
        config={TREND_CHART_CONFIG}
        className="aspect-auto h-80 w-full"
      >
        <ComposedChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 12, right: 12, top: 12 }}
        >
          <defs>
            <linearGradient id="trend-income-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-income)"
                stopOpacity={0.7}
              />
              <stop
                offset="95%"
                stopColor="var(--color-income)"
                stopOpacity={0.1}
              />
            </linearGradient>
            <linearGradient id="trend-expense-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-expense)"
                stopOpacity={0.7}
              />
              <stop
                offset="95%"
                stopColor="var(--color-expense)"
                stopOpacity={0.1}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(month: string) => formatMonthShort(month)}
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
                labelFormatter={(label) => formatMonthShort(String(label))}
                formatter={(value, name) => (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {TREND_CHART_CONFIG[
                        name as keyof typeof TREND_CHART_CONFIG
                      ]?.label ?? name}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatMoney(Number(value), baseCurrency)}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="var(--color-income)"
            fill="url(#trend-income-fill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="var(--color-expense)"
            fill="url(#trend-expense-fill)"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="var(--color-net)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

function formatMonthShort(month: string): string {
  return format(parseISO(`${month}-01`), "LLL yyyy");
}

function formatChartTick(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function TrendSkeleton() {
  return (
    <div
      data-testid="trend-loading"
      aria-busy="true"
      className="flex flex-col gap-2"
    >
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

function TrendError() {
  return (
    <p
      data-testid="trend-error"
      role="alert"
      className="rounded-md border border-destructive/50 p-4 text-sm text-destructive"
    >
      Could not load the trend. Refresh and try again.
    </p>
  );
}
