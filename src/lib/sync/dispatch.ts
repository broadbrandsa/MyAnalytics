import "server-only";
import type { DateWindow, SyncTrigger } from "@/lib/sync/windows";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Run an async fn over items with bounded concurrency. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, run),
  );
  return results;
}

/**
 * Fires the per-source worker as a separate function invocation (fan-out, so
 * one bad tenant can't starve the rest). Authenticates with CRON_SECRET.
 */
export async function callSyncWorker(
  dataSourceId: string,
  trigger: SyncTrigger,
  window?: DateWindow,
): Promise<unknown> {
  try {
    const res = await fetch(`${SITE_URL}/api/sync/${dataSourceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ trigger, window }),
    });
    return await res.json().catch(() => ({ status: "error" }));
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "dispatch failed",
    };
  }
}

/** Kick off (or continue) a chained backfill for a source at a chunk index. */
export async function callBackfill(
  dataSourceId: string,
  chunkIndex: number,
): Promise<void> {
  try {
    await fetch(`${SITE_URL}/api/backfill/${dataSourceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ chunkIndex }),
    });
  } catch {
    // Fire-and-forget; failures are visible via sync_runs / backfill_completed_at.
  }
}
