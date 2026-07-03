import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { runSourceSync } from "@/lib/sync/worker";
import { callBackfill } from "@/lib/sync/dispatch";
import { backfillChunks } from "@/lib/sync/windows";
import { BACKFILL_MONTHS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Chained month-chunk backfill (doc 02): syncs one month, then schedules the
 * next chunk as a fresh invocation via after() so each stays within the
 * function budget. When all chunks are done, stamps backfill_completed_at.
 *
 * Note: Meta very-large accounts may hit the data-per-call cap on a full month;
 * doc 07's async report-run path is a future refinement — a failed chunk is
 * recorded in sync_runs and does not block the chain.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dataSourceId: string }> },
) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { dataSourceId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    chunkIndex?: number;
  };
  const chunkIndex = body.chunkIndex ?? 0;

  const chunks = backfillChunks(BACKFILL_MONTHS);

  if (chunkIndex >= chunks.length) {
    const svc = createServiceClient();
    await svc
      .from("data_sources")
      .update({ backfill_completed_at: new Date().toISOString() })
      .eq("id", dataSourceId);
    return NextResponse.json({ ok: true, done: true, chunks: chunks.length });
  }

  const outcome = await runSourceSync(
    dataSourceId,
    "backfill",
    chunks[chunkIndex],
  );

  // Chain the next chunk after responding.
  after(() => callBackfill(dataSourceId, chunkIndex + 1));

  return NextResponse.json({
    ok: true,
    chunk: chunkIndex,
    of: chunks.length,
    outcome,
  });
}
