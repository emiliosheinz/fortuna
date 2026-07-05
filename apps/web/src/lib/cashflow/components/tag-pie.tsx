"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMoney } from "../format-money";
import type { TagBucket } from "../types";

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function tagColor(index: number): string {
  return (PIE_COLORS[index % PIE_COLORS.length] ?? PIE_COLORS[0]) as string;
}

type LabelMode = "none" | "legend" | "leader";

interface TagPieProps {
  buckets: TagBucket[];
  baseCurrency: string;
  className?: string;
  innerRadius?: number;
  outerRadius?: number;
  labels?: LabelMode;
}

interface LeaderLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  name?: string;
  fill?: string;
}

function LeaderLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  name = "",
}: LeaderLabelProps) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="fill-foreground text-xs"
    >
      {name}
    </text>
  );
}

export function TagPie({
  buckets,
  baseCurrency,
  className = "mx-auto aspect-square h-72",
  innerRadius = 60,
  outerRadius = 100,
  labels = "none",
}: TagPieProps) {
  const chartData = buckets.map((bucket, index) => ({
    key: bucket.tagId ?? "__untagged__",
    name: bucket.tagName ?? "Untagged",
    value: Number(bucket.expense),
    color: tagColor(index),
  }));
  const chartConfig = chartData.reduce<ChartConfig>((acc, entry) => {
    acc[entry.name] = { label: entry.name, color: entry.color };
    return acc;
  }, {});

  return (
    <ChartContainer config={chartConfig} className={className}>
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {item?.payload?.name ?? ""}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatMoney(Number(value), baseCurrency)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          strokeWidth={2}
          label={labels === "leader" ? <LeaderLabel /> : undefined}
          labelLine={
            labels === "leader"
              ? { stroke: "currentColor", strokeOpacity: 0.4 }
              : false
          }
        >
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={entry.color} />
          ))}
        </Pie>
        {labels === "legend" ? (
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            wrapperStyle={{ paddingTop: 12 }}
          />
        ) : null}
      </PieChart>
    </ChartContainer>
  );
}
