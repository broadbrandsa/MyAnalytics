import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runSourceSync } from "@/lib/sync/worker";
import type { DateWindow, SyncTrigger } from "@/lib/sync/windows";

export const dynamic = "force-dynamic";
export const maxDuration = 800; // Vercel Pro

/**
 * Per-source sync worker. Invoked by the cron fan-out and /api/refresh, both of
 * which pass the CRON_SECRET. Runs the full load→fetch→normalize→upsert→finalize
 * flow for one data source.
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
    trigger?: SyncTrigger;
    window?: DateWindow;
  };

  const outcome = await runSourceSync(
    dataSourceId,
    body.trigger ?? "cron",
    body.window,
  );

  const httpStatus = outcome.status === "error" ? 502 : 200;
  return NextResponse.json(outcome, { status: httpStatus });
}
