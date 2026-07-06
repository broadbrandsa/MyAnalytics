import { redirect } from "next/navigation";
import { getAccessClientId } from "@/lib/access/cookie";
import { createServiceClient } from "@/lib/supabase/service";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import type { RangeParams } from "@/lib/dashboard/range";
import type { ClientRow } from "@/lib/data/clients";

/**
 * Code-gated client dashboard. Resolves the client from the signed access
 * cookie and renders the dashboard from cached data only (service-role reads
 * scoped to that client_id — no Supabase session/RLS here).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RangeParams>;
}) {
  const clientId = await getAccessClientId();
  if (!clientId) redirect("/");

  const svc = createServiceClient();
  const { data: client } = await svc
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (!client || client.is_archived) redirect("/");

  const params = await searchParams;
  return <DashboardScreen client={client as ClientRow} params={params} />;
}
