import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { DataSourceRow } from "@/lib/sources-shared";
import type { DateWindow, SyncTrigger } from "@/lib/sync/windows";

export type ServiceDb = SupabaseClient<Database>;

/** Everything a source sync module needs. Upserts use the service-role client. */
export interface SyncContext {
  dataSource: DataSourceRow;
  window: DateWindow;
  trigger: SyncTrigger;
  token: string; // Google access token or Meta system-user token
  svc: ServiceDb;
}

export interface SyncResult {
  rowsUpserted: number;
  telemetry?: Record<string, unknown>;
}
