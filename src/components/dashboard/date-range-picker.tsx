"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RANGE_PRESETS, type RangePreset } from "@/lib/dashboard/range";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Date-range control. State lives in the URL search params so the RSC dashboard
 * re-fetches from cache on change (no client-side data fetching).
 */
export function DateRangePicker({
  preset,
  from,
  to,
  compare,
}: {
  preset: RangePreset;
  from: string;
  to: string;
  compare: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3" data-pending={pending}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="range" className="text-xs">
          Date range
        </Label>
        <select
          id="range"
          value={preset}
          onChange={(e) =>
            update({ range: e.target.value as RangePreset })
          }
          className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {preset === "custom" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              type="date"
              defaultValue={from}
              max={to}
              onChange={(e) => update({ from: e.target.value })}
              className="h-8 w-auto"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to" className="text-xs">
              To
            </Label>
            <Input
              id="to"
              type="date"
              defaultValue={to}
              min={from}
              onChange={(e) => update({ to: e.target.value })}
              className="h-8 w-auto"
            />
          </div>
        </>
      )}

      <label className="flex h-8 items-center gap-2 text-sm">
        <Checkbox
          checked={compare}
          onCheckedChange={(v) =>
            update({ compare: v ? null : "none" })
          }
        />
        Compare to previous period
      </label>
    </div>
  );
}
