"use client";

import { format, parseISO } from "date-fns";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrend } from "../hooks";
import type { MonthBucket } from "../types";

interface TrendViewProps {
  from: string | null;
  to: string | null;
  onWindowChange: (window: { from: string | null; to: string | null }) => void;
}

export function TrendView({ from, to, onWindowChange }: TrendViewProps) {
  const fromId = useId();
  const toId = useId();
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
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fromId}>From</Label>
            <Input
              id={fromId}
              type="month"
              data-testid="trend-from-input"
              value={from ?? ""}
              onChange={(e) =>
                onWindowChange({ from: e.target.value || null, to })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={toId}>To</Label>
            <Input
              id={toId}
              type="month"
              data-testid="trend-to-input"
              value={to ?? ""}
              onChange={(e) =>
                onWindowChange({ from, to: e.target.value || null })
              }
            />
          </div>
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

function TrendChart({
  points,
  baseCurrency,
}: {
  points: MonthBucket[];
  baseCurrency: string;
}) {
  const max = points.reduce(
    (acc, p) => Math.max(acc, Number(p.income), Number(p.expense)),
    0,
  );
  return (
    <div
      data-testid="trend-chart"
      className="flex flex-col gap-2 rounded-md border border-border"
    >
      <ul className="flex flex-col divide-y divide-border">
        {points.map((point) => (
          <TrendRow
            key={point.month}
            point={point}
            max={max}
            baseCurrency={baseCurrency}
          />
        ))}
      </ul>
    </div>
  );
}

function TrendRow({
  point,
  max,
  baseCurrency,
}: {
  point: MonthBucket;
  max: number;
  baseCurrency: string;
}) {
  const income = Number(point.income);
  const expense = Number(point.expense);
  const incomePct = max === 0 ? 0 : Math.round((income / max) * 100);
  const expensePct = max === 0 ? 0 : Math.round((expense / max) * 100);
  const net = Number(point.net);
  const netClass =
    net > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : net < 0
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <li data-testid="trend-row" className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{formatMonthShort(point.month)}</span>
        <span
          data-testid="trend-row-net"
          className={`font-semibold ${netClass}`}
        >
          {point.net} {baseCurrency}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <Bar
          label="Income"
          percent={incomePct}
          tone="positive"
          amount={point.income}
        />
        <Bar
          label="Expense"
          percent={expensePct}
          tone="negative"
          amount={point.expense}
        />
      </div>
    </li>
  );
}

function Bar({
  label,
  percent,
  tone,
  amount,
}: {
  label: string;
  percent: number;
  tone: "positive" | "negative";
  amount: string;
}) {
  const colour =
    tone === "positive"
      ? "bg-emerald-500/70 dark:bg-emerald-400/60"
      : "bg-destructive/70";
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="basis-16">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 ${colour}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="basis-20 text-right tabular-nums">{amount}</span>
    </div>
  );
}

function formatMonthShort(month: string): string {
  return format(parseISO(`${month}-01`), "LLL yyyy");
}

function TrendSkeleton() {
  return (
    <div
      data-testid="trend-loading"
      aria-busy="true"
      className="flex flex-col gap-2"
    >
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
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
