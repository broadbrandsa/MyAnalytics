import "server-only";
import { fetchGa4Reports } from "@/lib/integrations/ga4/client";
import { normalizeGa4 } from "@/lib/integrations/ga4/types";
import { upsertRows } from "@/lib/sync/upsert";
import type { SyncContext, SyncResult } from "@/lib/sync/types";

/**
 * GA4 sync (doc 04): one batchRunReports call → normalize → idempotent upserts
 * into metrics_ga4_daily (channel + TOTAL rows w/ device_split) and
 * metrics_ga4_pages. The ONLY place the GA4 API is touched.
 */
export async function syncGa4(ctx: SyncContext): Promise<SyncResult> {
  const { dataSource, window, token, svc } = ctx;

  const json = await fetchGa4Reports(token, dataSource.external_id, window);
  const { daily, pages } = normalizeGa4(json);

  const base = { data_source_id: dataSource.id, client_id: dataSource.client_id };

  const dailyRows = daily.map((r) => ({ ...base, ...r }));
  const pageRows = pages.map((r) => ({ ...base, ...r }));

  const n1 = await upsertRows(
    svc,
    "metrics_ga4_daily",
    dailyRows,
    "data_source_id,metric_date,channel",
  );
  const n2 = await upsertRows(
    svc,
    "metrics_ga4_pages",
    pageRows,
    "data_source_id,metric_date,landing_page",
  );

  return { rowsUpserted: n1 + n2 };
}
