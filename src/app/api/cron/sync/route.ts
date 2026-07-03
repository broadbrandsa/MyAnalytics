import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { mapWithConcurrency, callSyncWorker } from "@/lib/sync/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Nightly cron entry (vercel.json: 05:15 UTC). Lists active data sources and
 * fans out to the per-source worker with small concurrency, so one slow/broken
 * source can't starve the rest. Each worker records its own sync_run.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data: sources, error } = await svc
    .from("data_sources")
    .select("id")
    .eq("is_active", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await mapWithConcurrency(
    sources ?? [],
    5,
    (s) => callSyncWorker(s.id, "cron"),
  );

  return NextResponse.json({ dispatched: sources?.length ?? 0, results });
}

// Vercel Cron issues GET.
export const GET = POST;
