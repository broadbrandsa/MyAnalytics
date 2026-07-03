import {
  NIGHTLY_WINDOW_DAYS,
  REFRESH_WINDOW_DAYS,
  RECONCILE_WINDOW_DAYS,
} from "@/lib/constants";

export type SyncTrigger = "cron" | "refresh" | "backfill" | "manual";

export interface DateWindow {
  start: string; // YYYY-MM-DD (inclusive)
  end: string; // YYYY-MM-DD (inclusive)
}

/** Today in UTC as YYYY-MM-DD. Platform data is stored at face value. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD date by `days` (can be negative), UTC-safe. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Rolling window ending today for the given trigger. */
export function windowForTrigger(
  trigger: SyncTrigger,
  now: Date = new Date(),
): DateWindow {
  const end = todayUtc(now);
  const days =
    trigger === "refresh"
      ? REFRESH_WINDOW_DAYS
      : trigger === "manual"
        ? RECONCILE_WINDOW_DAYS
        : NIGHTLY_WINDOW_DAYS;
  // window covers `days` days ending today (inclusive) → start = today-(days-1)
  return { start: shiftDate(end, -(days - 1)), end };
}

/** Explicit N-day window ending today (used by reconcile = 90d). */
export function rollingWindow(days: number, now: Date = new Date()): DateWindow {
  const end = todayUtc(now);
  return { start: shiftDate(end, -(days - 1)), end };
}

/**
 * Month chunks (oldest→newest) covering the last `months` months up to today,
 * for chained backfill. Each chunk is a whole calendar-month-ish slice capped
 * at today. Returned oldest-first so backfill can walk forward.
 */
export function backfillChunks(
  months: number,
  now: Date = new Date(),
): DateWindow[] {
  const end = todayUtc(now);
  const chunks: DateWindow[] = [];
  // Start from `months` ago, first of that month.
  const first = new Date(`${end}T00:00:00Z`);
  first.setUTCDate(1);
  first.setUTCMonth(first.getUTCMonth() - (months - 1));

  const cursor = new Date(first);
  while (cursor.toISOString().slice(0, 10) <= end) {
    const chunkStart = cursor.toISOString().slice(0, 10);
    const monthEnd = new Date(cursor);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    monthEnd.setUTCDate(0); // last day of cursor's month
    let chunkEnd = monthEnd.toISOString().slice(0, 10);
    if (chunkEnd > end) chunkEnd = end;
    chunks.push({ start: chunkStart, end: chunkEnd });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    cursor.setUTCDate(1);
  }
  return chunks;
}

/** Monday-based week start (YYYY-MM-DD) for GSC weekly grain. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Complete Monday→Sunday weeks overlapping [start,end], oldest-first. */
export function weeksInWindow(win: DateWindow): DateWindow[] {
  const out: DateWindow[] = [];
  let ws = weekStart(win.start);
  while (ws <= win.end) {
    out.push({ start: ws, end: shiftDate(ws, 6) });
    ws = shiftDate(ws, 7);
  }
  return out;
}
