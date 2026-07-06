"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from "@/components/ui/chart";
import { fmtShortDate, fmtCompactNumber } from "@/lib/dashboard/format";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * Generic time-series chart (area or bar) over a date-keyed dataset. Data is
 * serialized from an RSC parent; this renders client-side (charts must be
 * client components).
 */
export function TimeSeries({
  data,
  series,
  kind = "area",
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string }[];
  kind?: "area" | "bar";
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: s.label, color: PALETTE[i % PALETTE.length] },
    ]),
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      {kind === "bar" ? (
        <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(v) => fmtShortDate(String(v))}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => fmtCompactNumber(Number(v))}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 && <ChartLegend />}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              radius={4}
            />
          ))}
        </BarChart>
      ) : (
        <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(v) => fmtShortDate(String(v))}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => fmtCompactNumber(Number(v))}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 && <ChartLegend />}
          {series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              fill={`var(--color-${s.key})`}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      )}
    </ChartContainer>
  );
}
