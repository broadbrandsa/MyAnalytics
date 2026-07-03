import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { mapWithConcurrency, callSyncWorker } from "@/lib/sync/dispatch";
import { rollingWindow } from "@/lib/sync/windows";
import { RECONCILE_WINDOW_DAYS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Monthly reconciliation (vercel.json: 1st of month, 06:30 UTC). Re-syncs a
 * 90-day window to catch late platform restatements the nightly 35-day window
 * misses.
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

  const window = rollingWindow(RECONCILE_WINDOW_DAYS);
  const results = await mapWithConcurrency(sources ?? [], 5, (s) =>
    callSyncWorker(s.id, "manual", window),
  );

  return NextResponse.json({ dispatched: sources?.length ?? 0, window, results });
}

export const GET = POST;
