import "server-only";
import type { ServiceDb } from "@/lib/sync/types";
import type { DateWindow, SyncTrigger } from "@/lib/sync/windows";
import type { Json } from "@/lib/database.types";

/**
 * sync_runs is the audit log. Every sync execution — success OR failure —
 * creates a row here and finalizes it (CLAUDE.md convention).
 */

export async function startSyncRun(
  svc: ServiceDb,
  opts: {
    dataSourceId: string;
    clientId: string;
    trigger: SyncTrigger;
    window: DateWindow;
  },
): Promise<string> {
  const { data, error } = await svc
    .from("sync_runs")
    .insert({
      data_source_id: opts.dataSourceId,
      client_id: opts.clientId,
      trigger: opts.trigger,
      window_start: opts.window.start,
      window_end: opts.window.end,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function finalizeSyncRun(
  svc: ServiceDb,
  runId: string,
  result: {
    status: "success" | "error";
    rowsUpserted?: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    telemetry?: Record<string, unknown> | null;
  },
): Promise<void> {
  await svc
    .from("sync_runs")
    .update({
      status: result.status,
      rows_upserted: result.rowsUpserted ?? null,
      error_code: result.errorCode ?? null,
      error_message: result.errorMessage ?? null,
      telemetry: (result.telemetry ?? null) as Json,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}
