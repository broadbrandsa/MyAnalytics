import { redirect } from "next/navigation";
import { getAccessClientId } from "@/lib/access/cookie";
import { createServiceClient } from "@/lib/supabase/service";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import type { ClientRow } from "@/lib/data/clients";

/**
 * Code-gated client dashboard. Resolves the client from the signed access
 * cookie and reads ONLY that client's cached data via the service-role client,
 * explicitly filtered by client_id (there is no Supabase session/RLS here).
 *
 * A stale cookie (client archived/deleted) just bounces to "/", which renders
 * the code-entry form — the cookie can't be mutated during RSC render, so it's
 * cleared on the next successful entry or via /access/exit.
 */
export default async function DashboardPage() {
  const clientId = await getAccessClientId();
  if (!clientId) redirect("/");

  const svc = createServiceClient();
  const { data: client } = await svc
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (!client || client.is_archived) redirect("/");

  return <ClientDashboard client={client as ClientRow} />;
}
