import { createClient } from "@/lib/supabase/server";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientRow } from "@/lib/data/clients";

/**
 * Viewer dashboard. Resolves the viewer's client via membership (RLS scopes
 * the read to their own client rows). If a viewer belongs to more than one
 * client, the first is shown — a switcher can come later.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("is_archived", false)
    .order("name");

  const client = (data as ClientRow[] | null)?.[0];

  if (!client) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No dashboard assigned</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Your account isn&apos;t linked to a client yet. Please contact your
          Broadbrand account manager.
        </CardContent>
      </Card>
    );
  }

  return <ClientDashboard client={client} />;
}
