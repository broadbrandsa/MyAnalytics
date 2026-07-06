import { todayUtc, shiftDate } from "@/lib/sync/windows";

/**
 * Dashboard date range resolved from URL search params. Dates are YYYY-MM-DD and
 * treated at face value (see CLAUDE.md dates convention). The comparison window
 * is the immediately-preceding period of equal length.
 */
export type RangePreset =
  | "last_7_days"
  | "last_28_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "last_month"
  | "custom";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_28_days", label: "Last 28 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

export interface ResolvedRange {
  preset: RangePreset;
  start: string;
  end: string;
  label: string;
  compare: boolean;
  compareStart: string;
  compareEnd: string;
  /** inclusive day count */
  days: number;
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function daysBetween(start: string, end: string): number {
  const ms =
    new Date(`${end}T00:00:00Z`).getTime() -
    new Date(`${start}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export interface RangeParams {
  range?: string;
  from?: string;
  to?: string;
  compare?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve URL params into a concrete window + previous-period window. */
export function resolveRange(
  params: RangeParams,
  now: Date = new Date(),
): ResolvedRange {
  const today = todayUtc(now);
  const preset = (params.range as RangePreset) || "last_28_days";

  let start: string;
  let end: string = today;
  let label = "";

  switch (preset) {
    case "last_7_days":
      start = shiftDate(today, -6);
      label = "Last 7 days";
      break;
    case "last_30_days":
      start = shiftDate(today, -29);
      label = "Last 30 days";
      break;
    case "last_90_days":
      start = shiftDate(today, -89);
      label = "Last 90 days";
      break;
    case "this_month":
      start = monthStart(today);
      label = "This month";
      break;
    case "last_month": {
      const firstThis = monthStart(today);
      end = shiftDate(firstThis, -1);
      start = monthStart(end);
      label = "Last month";
      break;
    }
    case "custom": {
      const validFrom = params.from && DATE_RE.test(params.from);
      const validTo = params.to && DATE_RE.test(params.to);
      if (validFrom && validTo && params.from! <= params.to!) {
        start = params.from!;
        end = params.to!;
        label = "Custom";
      } else {
        start = shiftDate(today, -27);
        label = "Last 28 days";
      }
      break;
    }
    case "last_28_days":
    default:
      start = shiftDate(today, -27);
      label = "Last 28 days";
      break;
  }

  const days = daysBetween(start, end);
  const compareEnd = shiftDate(start, -1);
  const compareStart = shiftDate(compareEnd, -(days - 1));
  const compare = params.compare !== "none";

  return {
    preset,
    start,
    end,
    label,
    compare,
    compareStart,
    compareEnd,
    days,
  };
}

/** Percentage change current vs previous; null when previous is 0/undefined. */
export function pctChange(
  current: number,
  previous: number | null | undefined,
): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
