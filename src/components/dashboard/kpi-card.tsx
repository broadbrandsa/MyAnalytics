import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pctChange } from "@/lib/dashboard/range";
import type { Kpi } from "@/lib/dashboard/types";

/**
 * KPI scorecard: formatted value + % change vs the previous period. For metrics
 * where lower is better (position, CPC, CPM) pass higherIsBetter={false} so the
 * delta colour reflects "good/bad" rather than "up/down".
 */
export function KpiCard({
  label,
  kpi,
  format,
  higherIsBetter = true,
}: {
  label: string;
  kpi: Kpi;
  format: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  const change = pctChange(kpi.value, kpi.prev);
  const up = change != null && change >= 0;
  const good = change == null ? null : higherIsBetter ? up : !up;

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
        <span className="text-2xl font-semibold tabular-nums">
          {format(kpi.value)}
        </span>
        {change != null ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              good
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-red-600 dark:text-red-500",
            )}
          >
            {up ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )}
            {Math.abs(change).toFixed(1)}%
            <span className="text-muted-foreground font-normal">
              vs prev
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">&nbsp;</span>
        )}
      </CardContent>
    </Card>
  );
}
