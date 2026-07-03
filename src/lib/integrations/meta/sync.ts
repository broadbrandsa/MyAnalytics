import "server-only";
import { fetchMetaInsights } from "@/lib/integrations/meta/client";
import { normalizeMetaInsights } from "@/lib/integrations/meta/types";
import { upsertRows } from "@/lib/sync/upsert";
import type { SyncContext, SyncResult } from "@/lib/sync/types";

/**
 * Meta sync (doc 07): campaign-level insights → per-campaign rows, plus an
 * account-level pass → TOTAL rows (the only reliable source of reach). Both
 * upsert idempotently into metrics_meta_daily. `conversions` is extracted from
 * `actions` using the source's configured primary_action.
 */
export async function syncMeta(ctx: SyncContext): Promise<SyncResult> {
  const { dataSource, window, token, svc } = ctx;
  const actId = dataSource.external_id;
  const primaryAction = (dataSource.config as { primary_action?: string } | null)
    ?.primary_action;

  const [campaignJson, accountJson] = await Promise.all([
    fetchMetaInsights(token, actId, window, "campaign"),
    fetchMetaInsights(token, actId, window, "account"),
  ]);

  const rows = [
    ...normalizeMetaInsights(campaignJson, "campaign", primaryAction),
    ...normalizeMetaInsights(accountJson, "account", primaryAction),
  ].map((r) => ({
    data_source_id: dataSource.id,
    client_id: dataSource.client_id,
    ...r,
  }));

  const n = await upsertRows(
    svc,
    "metrics_meta_daily",
    rows,
    "data_source_id,metric_date,campaign_id",
  );
  return { rowsUpserted: n };
}
