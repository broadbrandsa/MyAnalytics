import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DataSourceRow, SourceHealthRow } from "@/lib/sources-shared";

export type { DataSourceRow, SourceHealthRow } from "@/lib/sources-shared";
export { SOURCE_META } from "@/lib/sources-shared";

/** Existing data sources assigned to a client (RLS-scoped; admins see all). */
export async function listDataSources(
  clientId: string,
): Promise<DataSourceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_sources")
    .select("*")
    .eq("client_id", clientId)
    .order("source");
  if (error) throw error;
  return data ?? [];
}

/** All data sources with their client name — for the connection health panel. */
export async function listAllSourcesWithClient(): Promise<SourceHealthRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_sources")
    .select("*, clients(name)")
    .order("last_synced_at", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return (data as SourceHealthRow[]) ?? [];
}
