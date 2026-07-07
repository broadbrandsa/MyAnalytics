import "server-only";
import { fetchGadsCampaignReport } from "@/lib/integrations/gads/client";
import { normalizeGadsCampaigns } from "@/lib/integrations/gads/types";
import { upsertRows } from "@/lib/sync/upsert";
import type { SyncContext, SyncResult } from "@/lib/sync/types";

/**
 * Google Ads sync (doc 06): one searchStream campaign report → per-campaign
 * rows + summed TOTAL rows → idempotent upsert into metrics_gads_daily.
 */
export async function syncGoogleAds(ctx: SyncContext): Promise<SyncResult> {
  const { dataSource, window, token, svc } = ctx;

  const loginCustomerId = (
    dataSource.config as { login_customer_id?: string } | null
  )?.login_customer_id;
  const json = await fetchGadsCampaignReport(
    token,
    dataSource.external_id,
    window,
    loginCustomerId,
  );
  const rows = normalizeGadsCampaigns(json).map((r) => ({
    data_source_id: dataSource.id,
    client_id: dataSource.client_id,
    ...r,
  }));

  const n = await upsertRows(
    svc,
    "metrics_gads_daily",
    rows,
    "data_source_id,metric_date,campaign_id",
  );
  return { rowsUpserted: n };
}
