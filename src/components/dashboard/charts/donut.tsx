"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Donut breakdown of category → value (e.g. sessions by channel/device). */
export function Donut({
  data,
  nameKey,
  valueKey,
}: {
  data: Record<string, string | number>[];
  nameKey: string;
  valueKey: string;
}) {
  const top = data.slice(0, 6);
  const config: ChartConfig = Object.fromEntries(
    top.map((d, i) => [
      String(d[nameKey]),
      { label: String(d[nameKey]), color: PALETTE[i % PALETTE.length] },
    ]),
  );

  return (
    <ChartContainer
      config={config}
      className="mx-auto aspect-square h-[240px]"
    >
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
        <Pie
          data={top}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius={60}
          strokeWidth={2}
        >
          {top.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
