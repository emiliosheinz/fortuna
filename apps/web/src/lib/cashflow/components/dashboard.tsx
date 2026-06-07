"use client";

import { format, parseISO, subMonths } from "date-fns";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Area, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useBaseCurrency,
  useSummary,
  useTransactions,
  useTrend,
} from "../hooks";
import type { MonthBucket } from "../types";

const TOP_CATEGORIES = 5;
const RECENT_LIMIT = 5;
const TREND_MONTHS = 6;

const TREND_CHART_CONFIG = {
  income: { label: "Income", color: "var(--chart-2)" },
  expense: { label: "Expense", color: "var(--chart-1)" },
  net: { label: "Net", color: "var(--chart-3)" },
} satisfies ChartConfig;

function currentMonth(): string {
  return format(new Date(), "yyyy-MM");
}

function trendWindow(): { from: string; to: string } {
  const now = new Date();
  return {
    from: format(subMonths(now, TREND_MONTHS - 1), "yyyy-MM"),
    to: format(now, "yyyy-MM"),
  };
}

function formatMonthLong(month: string): string {
  return format(parseISO(`${month}-01`), "LLLL yyyy");
}

function formatMonthShort(month: string): string {
  return format(parseISO(`${month}-01`), "LLL yyyy");
}

export function Dashboard() {
  const baseCurrencyQ = useBaseCurrency();

  if (baseCurrencyQ.isPending) return <DashboardSkeleton />;
  if (baseCurrencyQ.isError || !baseCurrencyQ.data) {
    return (
      <p
        role="alert"
        data-testid="dashboard-error"
        className="text-sm text-destructive"
      >
        Could not load your dashboard. Refresh and try again.
      </p>
    );
  }

  const baseCurrency = baseCurrencyQ.data.baseCurrency;
  const month = currentMonth();
  const window = trendWindow();

  return (
    <div
      data-testid="dashboard-grid"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      <ThisMonthCard month={month} baseCurrency={baseCurrency} />
      <SixMonthTrendCard window={window} baseCurrency={baseCurrency} />
      <WhereItWentCard month={month} baseCurrency={baseCurrency} />
      <RecentActivityCard baseCurrency={baseCurrency} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      data-testid="dashboard-loading"
      aria-busy="true"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-56 w-full" />
      ))}
    </div>
  );
}

interface CardShellProps {
  title: string;
  subtitle?: string;
  href: string;
  hrefLabel: string;
  testId: string;
  children: React.ReactNode;
}

function CardShell({
  title,
  subtitle,
  href,
  hrefLabel,
  testId,
  children,
}: CardShellProps) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-3 rounded-md border border-border p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-md text-xs text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {hrefLabel}
          <ArrowRightIcon className="size-3" aria-hidden />
        </Link>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function CardError() {
  return (
    <p role="alert" className="text-xs text-destructive">
      Could not load this card.
    </p>
  );
}

function CardEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  );
}

function ThisMonthCard({
  month,
  baseCurrency,
}: {
  month: string;
  baseCurrency: string;
}) {
  const query = useSummary(month);
  return (
    <CardShell
      title="This month"
      subtitle={formatMonthLong(month)}
      href="/summary"
      hrefLabel="View summary"
      testId="dashboard-this-month"
    >
      {renderThisMonth(query, baseCurrency)}
    </CardShell>
  );
}

function renderThisMonth(
  query: ReturnType<typeof useSummary>,
  baseCurrency: string,
): React.ReactNode {
  if (query.isPending) return <CardSkeleton lines={3} />;
  if (query.isError || !query.data) return <CardError />;
  return (
    <dl className="grid grid-cols-3 gap-2">
      <Stat
        label="Income"
        value={query.data.income}
        unit={baseCurrency}
        tone="positive"
      />
      <Stat
        label="Expense"
        value={query.data.expense}
        unit={baseCurrency}
        tone="negative"
      />
      <Stat
        label="Net"
        value={query.data.net}
        unit={baseCurrency}
        tone="neutral"
      />
    </dl>
  );
}

function Stat({
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
    <div className="flex flex-col gap-1 rounded-md border border-border p-2">
      <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-lg font-semibold tabular-nums", valueClass)}>
        {value} <span className="text-xs font-normal">{unit}</span>
      </dd>
    </div>
  );
}

function SixMonthTrendCard({
  window,
  baseCurrency,
}: {
  window: { from: string; to: string };
  baseCurrency: string;
}) {
  const query = useTrend(window);
  return (
    <CardShell
      title="6-month trend"
      subtitle={`${formatMonthShort(window.from)} – ${formatMonthShort(window.to)}`}
      href="/trend"
      hrefLabel="View trend"
      testId="dashboard-trend"
    >
      {renderTrend(query, baseCurrency)}
    </CardShell>
  );
}

function renderTrend(
  query: ReturnType<typeof useTrend>,
  baseCurrency: string,
): React.ReactNode {
  if (query.isPending) return <Skeleton className="h-40 w-full" />;
  if (query.isError || !query.data) return <CardError />;
  const isEmpty = query.data.points.every(
    (p) => p.income === "0.00" && p.expense === "0.00",
  );
  if (isEmpty) {
    return <CardEmpty>No transactions in the last 6 months.</CardEmpty>;
  }
  return (
    <CompactTrendChart points={query.data.points} baseCurrency={baseCurrency} />
  );
}

function CompactTrendChart({
  points,
  baseCurrency,
}: {
  points: MonthBucket[];
  baseCurrency: string;
}) {
  const data = points.map((p) => ({
    month: p.month,
    income: Number(p.income),
    expense: Number(p.expense),
    net: Number(p.net),
  }));
  return (
    <ChartContainer
      config={TREND_CHART_CONFIG}
      className="aspect-auto h-40 w-full"
    >
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 4, top: 8, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeOpacity={0.3} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          fontSize={10}
          tickFormatter={(month: string) =>
            format(parseISO(`${month}-01`), "LLL")
          }
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
                    {TREND_CHART_CONFIG[name as keyof typeof TREND_CHART_CONFIG]
                      ?.label ?? name}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {Number(value).toFixed(2)} {baseCurrency}
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
          fill="var(--color-income)"
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="var(--color-expense)"
          fill="var(--color-expense)"
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
        <Line
          type="monotone"
          dataKey="net"
          stroke="var(--color-net)"
          strokeWidth={1.5}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

function WhereItWentCard({
  month,
  baseCurrency,
}: {
  month: string;
  baseCurrency: string;
}) {
  const query = useSummary(month);
  return (
    <CardShell
      title="Where it went"
      subtitle={formatMonthLong(month)}
      href="/summary"
      hrefLabel="View breakdown"
      testId="dashboard-where-it-went"
    >
      {renderWhereItWent(query, baseCurrency)}
    </CardShell>
  );
}

function renderWhereItWent(
  query: ReturnType<typeof useSummary>,
  baseCurrency: string,
): React.ReactNode {
  if (query.isPending) return <CardSkeleton lines={5} />;
  if (query.isError || !query.data) return <CardError />;

  const top = query.data.byCategory
    .filter((bucket) => Number(bucket.expense) > 0)
    .sort((a, b) => Number(b.expense) - Number(a.expense))
    .slice(0, TOP_CATEGORIES);

  if (top.length === 0) {
    return <CardEmpty>No spending this month yet.</CardEmpty>;
  }

  return (
    <ul
      data-testid="dashboard-top-categories"
      className="flex flex-col divide-y divide-border"
    >
      {top.map((bucket) => (
        <li
          key={bucket.categoryId ?? "__uncategorized__"}
          className="flex items-center justify-between gap-3 py-1.5 text-sm"
        >
          <span className="min-w-0 truncate">
            {bucket.categoryName ?? "Uncategorized"}
          </span>
          <span className="whitespace-nowrap font-medium tabular-nums">
            {bucket.expense}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {baseCurrency}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecentActivityCard({
  baseCurrency: _baseCurrency,
}: {
  baseCurrency: string;
}) {
  const query = useTransactions({}, RECENT_LIMIT);
  return (
    <CardShell
      title="Recent activity"
      href="/transactions"
      hrefLabel="View all"
      testId="dashboard-recent-activity"
    >
      {renderRecent(query)}
    </CardShell>
  );
}

function renderRecent(
  query: ReturnType<typeof useTransactions>,
): React.ReactNode {
  if (query.isPending) return <CardSkeleton lines={5} />;
  if (query.isError) return <CardError />;
  const items =
    query.data?.pages.flatMap((page) => page.items).slice(0, RECENT_LIMIT) ??
    [];
  if (items.length === 0) {
    return <CardEmpty>No transactions yet.</CardEmpty>;
  }
  return (
    <ul
      data-testid="dashboard-recent-list"
      className="flex flex-col divide-y divide-border"
    >
      {items.map((tx) => (
        <li
          key={tx.id}
          className="flex items-center justify-between gap-3 py-1.5 text-sm"
        >
          <span className="min-w-0 truncate">{tx.description}</span>
          <span
            className={cn(
              "whitespace-nowrap font-medium tabular-nums",
              tx.kind === "income"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive",
            )}
          >
            {tx.kind === "income" ? "+" : "-"}
            {tx.amount}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {tx.currency}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
