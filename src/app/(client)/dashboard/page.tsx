import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Client dashboard. Phase 4 builds the real widgets (KPI cards, time series,
 * tables) reading from metrics_* tables. For now it renders an empty branded
 * shell scoped to the viewer's client(s) via RLS.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  // RLS: a client_viewer only sees their own client rows.
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, brand_color")
    .eq("is_archived", false)
    .order("name");

  const client = clients?.[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {client ? client.name : "Dashboard"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Your marketing performance across Meta, Google Ads, GA4, and Search
          Console.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No data yet</CardTitle>
          <CardDescription>
            Once your data sources are connected and synced, your dashboard will
            appear here. Widgets arrive in Phase 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          If you believe this is an error, contact your Broadbrand account
          manager.
        </CardContent>
      </Card>
    </div>
  );
}
