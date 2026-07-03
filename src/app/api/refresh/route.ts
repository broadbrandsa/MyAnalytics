import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { mapWithConcurrency, callSyncWorker } from "@/lib/sync/dispatch";
import { REFRESH_RATE_LIMIT_MINUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Client Refresh button (doc 02). Authenticates the CALLER with their session
 * (getUser) and verifies access via RLS (selecting the client only succeeds for
 * a member or admin). Enforces the 10-min rate limit, then switches to the
 * service-role client for writes — client_viewers have zero write policies.
 * Fans out a 7-day sync via after() and returns immediately; the client polls
 * sync_runs (RLS read) for progress.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    clientId?: string;
  };
  if (!body.clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  // RLS: this select returns the row only if the user is a member or admin.
  const { data: client } = await supabase
    .from("clients")
    .select("id, last_refresh_at")
    .eq("id", body.clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Rate limit.
  const windowMs = REFRESH_RATE_LIMIT_MINUTES * 60_000;
  if (client.last_refresh_at) {
    const elapsed = Date.now() - new Date(client.last_refresh_at).getTime();
    if (elapsed < windowMs) {
      const retryAfter = Math.ceil((windowMs - elapsed) / 1000);
      return NextResponse.json(
        { error: "rate_limited", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  // Writes via service role (client_viewers have no write policies).
  const svc = createServiceClient();
  await svc
    .from("clients")
    .update({ last_refresh_at: new Date().toISOString() })
    .eq("id", client.id);

  const { data: sources } = await svc
    .from("data_sources")
    .select("id")
    .eq("client_id", client.id)
    .eq("is_active", true);

  // Fan out after responding so the button returns instantly.
  after(async () => {
    await mapWithConcurrency(sources ?? [], 5, (s) =>
      callSyncWorker(s.id, "refresh"),
    );
  });

  return NextResponse.json({ ok: true, sources: sources?.length ?? 0 });
}
