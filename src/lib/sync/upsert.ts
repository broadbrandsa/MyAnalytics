import "server-only";
import type { ServiceDb } from "@/lib/sync/types";

const CHUNK = 500;

/**
 * Idempotent chunked upsert (CLAUDE.md hard rule #6). `onConflict` must be the
 * table's primary-key columns so re-running a window updates in place and never
 * changes row counts. Returns the number of rows written.
 */
export async function upsertRows<T extends Record<string, unknown>>(
  svc: ServiceDb,
  table: string,
  rows: T[],
  onConflict: string,
): Promise<number> {
  if (rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await svc
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(table as any)
      .upsert(batch as never, { onConflict });
    if (error) throw error;
  }
  return rows.length;
}
