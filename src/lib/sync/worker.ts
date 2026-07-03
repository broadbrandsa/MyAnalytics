import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getGoogleAccessToken } from "@/lib/integrations/shared/google-auth";
import { readSecret } from "@/lib/integrations/shared/vault";
import { markCredentialNeedsReauth } from "@/lib/integrations/shared/credentials-store";
import { startSyncRun, finalizeSyncRun } from "@/lib/sync/run";
import { classifyError } from "@/lib/sync/errors";
import { windowForTrigger, type DateWindow, type SyncTrigger } from "@/lib/sync/windows";
import type { SyncContext, SyncResult } from "@/lib/sync/types";
import { syncGa4 } from "@/lib/integrations/ga4/sync";
import { syncGsc } from "@/lib/integrations/gsc/sync";
import { syncGoogleAds } from "@/lib/integrations/gads/sync";
import { syncMeta } from "@/lib/integrations/meta/sync";
import type { Source } from "@/lib/constants";

function dispatch(source: Source, ctx: SyncContext): Promise<SyncResult> {
  switch (source) {
    case "ga4":
      return syncGa4(ctx);
    case "gsc":
      return syncGsc(ctx);
    case "google_ads":
      return syncGoogleAds(ctx);
    case "meta_ads":
      return syncMeta(ctx);
  }
}

export interface RunOutcome {
  status: "success" | "error" | "skipped";
  rowsUpserted?: number;
  error?: string;
  reason?: string;
}

/**
 * Runs one data source's sync end-to-end: load source + credential, mint token,
 * create the sync_run, dispatch to the source module, finalize, and map any
 * error to the doc 04–07 action (needs_reauth / deactivate / defer / fail).
 * Uses the service-role client throughout (server-only, bypasses RLS).
 */
export async function runSourceSync(
  dataSourceId: string,
  trigger: SyncTrigger,
  window?: DateWindow,
): Promise<RunOutcome> {
  const svc = createServiceClient();

  const { data: ds } = await svc
    .from("data_sources")
    .select("*")
    .eq("id", dataSourceId)
    .maybeSingle();
  if (!ds) return { status: "skipped", reason: "source not found" };
  if (!ds.is_active) return { status: "skipped", reason: "source inactive" };

  const { data: cred } = await svc
    .from("oauth_credentials")
    .select("*")
    .eq("id", ds.credential_id)
    .maybeSingle();
  if (!cred) return { status: "skipped", reason: "no credential" };

  const win = window ?? windowForTrigger(trigger);
  const runId = await startSyncRun(svc, {
    dataSourceId: ds.id,
    clientId: ds.client_id,
    trigger,
    window: win,
  });

  try {
    if (cred.status === "needs_reauth" || cred.status === "revoked") {
      throw new Error(`credential ${cred.status}`);
    }

    const token =
      cred.provider === "google"
        ? await getGoogleAccessToken(cred.vault_secret_id)
        : await readSecret(cred.vault_secret_id);

    const result = await dispatch(ds.source as Source, {
      dataSource: ds,
      window: win,
      trigger,
      token,
      svc,
    });

    await finalizeSyncRun(svc, runId, {
      status: "success",
      rowsUpserted: result.rowsUpserted,
      telemetry: result.telemetry ?? null,
    });
    await svc
      .from("data_sources")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", ds.id);

    return { status: "success", rowsUpserted: result.rowsUpserted };
  } catch (err) {
    const c = classifyError(err);
    await finalizeSyncRun(svc, runId, {
      status: "error",
      errorCode: c.errorCode,
      errorMessage: c.errorMessage,
    });

    if (c.action === "needs_reauth") {
      await markCredentialNeedsReauth(cred.id);
    } else if (c.action === "deactivate") {
      await svc
        .from("data_sources")
        .update({ is_active: false })
        .eq("id", ds.id);
    }
    // defer / fail: recorded on the run; next cron retries.
    return { status: "error", error: c.errorMessage };
  }
}
