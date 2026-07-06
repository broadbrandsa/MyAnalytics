import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessClientId } from "@/lib/access/cookie";
import { mapWithConcurrency, callSyncWorker } from "@/lib/sync/dispatch";
import { REFRESH_RATE_LIMIT_MINUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Client Refresh button (doc 02). Authorizes the caller two ways:
 *  1. Code access — a valid signed access cookie names the client directly.
 *  2. Session — an admin/member selects the client (verified via RLS).
 * Then enforces the 10-min rate limit and does all writes via service-role
 * (client_viewers / code visitors have no write policies). Fans out a 7-day
 * sync via after() and returns immediately; the client polls sync_runs.
 */
export async function POST(request: NextRequest) {
  let clientId = await getAccessClientId();

  // Session fallback (admin preview / invited login).
  if (!clientId) {
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
    // RLS returns the row only for a member/admin.
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", body.clientId)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    clientId = client.id;
  }

  const svc = createServiceClient();
  const { data: client } = await svc
    .from("clients")
    .select("id, last_refresh_at, is_archived")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.is_archived) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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

  await svc
    .from("clients")
    .update({ last_refresh_at: new Date().toISOString() })
    .eq("id", client.id);

  const { data: sources } = await svc
    .from("data_sources")
    .select("id")
    .eq("client_id", client.id)
    .eq("is_active", true);

  after(async () => {
    await mapWithConcurrency(sources ?? [], 5, (s) =>
      callSyncWorker(s.id, "refresh"),
    );
  });

  return NextResponse.json({ ok: true, sources: sources?.length ?? 0 });
}
