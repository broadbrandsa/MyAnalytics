import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessClientId } from "@/lib/access/cookie";

export const dynamic = "force-dynamic";

/**
 * Refresh progress for the current client. Code visitors have no session/RLS,
 * so status is served here (authorized by the access cookie, or a session for
 * admin/member) and scoped to that client's sync_runs.
 */
export async function GET(request: NextRequest) {
  let clientId = await getAccessClientId();

  if (!clientId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const reqId = new URL(request.url).searchParams.get("clientId");
    if (!reqId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", reqId)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    clientId = client.id;
  }

  const svc = createServiceClient();
  const { count: running } = await svc
    .from("sync_runs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", ["queued", "running"]);

  const { data: last } = await svc
    .from("data_sources")
    .select("last_synced_at")
    .eq("client_id", clientId)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    running: (running ?? 0) > 0,
    updatedAt: last?.last_synced_at ?? null,
  });
}
