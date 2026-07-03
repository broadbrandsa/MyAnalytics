import "server-only";
import {
  fetchGscDaily,
  fetchGscDevice,
  fetchGscDimension,
} from "@/lib/integrations/gsc/client";
import {
  normalizeGscDaily,
  normalizeGscDimension,
} from "@/lib/integrations/gsc/types";
import { upsertRows } from "@/lib/sync/upsert";
import {
  todayUtc,
  weekStart,
  weeksInWindow,
  shiftDate,
  type DateWindow,
} from "@/lib/sync/windows";
import { sleep } from "@/lib/integrations/shared/backoff";
import type { SyncContext, SyncResult } from "@/lib/sync/types";

/**
 * GSC sync (doc 05): daily totals (+ device split) over the window, plus
 * query/page weekly rollups. Nightly re-pulls the last 2 complete weeks;
 * refresh does daily only; backfill/reconcile do every complete week in range.
 */
export async function syncGsc(ctx: SyncContext): Promise<SyncResult> {
  const { dataSource, window, trigger, token, svc } = ctx;
  const site = dataSource.external_id;
  const today = todayUtc();
  const base = { data_source_id: dataSource.id, client_id: dataSource.client_id };
  let rows = 0;

  // Daily totals + device split
  const [dailyJson, deviceJson] = await Promise.all([
    fetchGscDaily(token, site, window),
    fetchGscDevice(token, site, window),
  ]);
  const daily = normalizeGscDaily(dailyJson, deviceJson, today).map((r) => ({
    ...base,
    ...r,
  }));
  rows += await upsertRows(
    svc,
    "metrics_gsc_daily",
    daily,
    "data_source_id,metric_date",
  );

  // Which weeks to (re)pull query/page rollups for.
  const thisMonday = weekStart(today);
  const weeks: DateWindow[] =
    trigger === "refresh"
      ? []
      : trigger === "backfill" || trigger === "manual"
        ? weeksInWindow(window).filter((w) => w.end < today)
        : [
            { start: shiftDate(thisMonday, -7), end: shiftDate(thisMonday, -1) },
            { start: shiftDate(thisMonday, -14), end: shiftDate(thisMonday, -8) },
          ];

  for (const week of weeks) {
    const [qJson, pJson] = await Promise.all([
      fetchGscDimension(token, site, week, "query"),
      fetchGscDimension(token, site, week, "page"),
    ]);
    const queries = normalizeGscDimension(qJson, week.start, "query").map(
      (r) => ({ ...base, ...r }),
    );
    const pages = normalizeGscDimension(pJson, week.start, "page").map((r) => ({
      ...base,
      ...r,
    }));
    rows += await upsertRows(
      svc,
      "metrics_gsc_queries",
      queries,
      "data_source_id,week_start,query",
    );
    rows += await upsertRows(
      svc,
      "metrics_gsc_pages",
      pages,
      "data_source_id,week_start,page",
    );
    await sleep(100); // respect QPM spacing (doc 05)
  }

  return { rowsUpserted: rows };
}
