import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClientRow } from "@/lib/data/clients";

/**
 * The read-only client dashboard surface. Rendered both for client_viewers at
 * /dashboard and for admins previewing at /admin/clients/[id]/preview.
 *
 * Phase 4 replaces the empty state with real widgets (KPI cards, time series,
 * tables) sourced from metrics_* tables — never live platform APIs.
 */
export function ClientDashboard({ client }: { client: ClientRow }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {client.logo_url ? (
          <Image
            src={client.logo_url}
            alt={`${client.name} logo`}
            width={40}
            height={40}
            className="rounded"
            unoptimized
          />
        ) : (
          <span
            className="inline-block size-8 rounded-full"
            style={{ backgroundColor: client.brand_color ?? "#e5e7eb" }}
            aria-hidden
          />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-muted-foreground text-sm">
            Marketing performance across Meta, Google Ads, GA4, and Search
            Console.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No data yet</CardTitle>
          <CardDescription>
            Once data sources are connected and synced, KPI cards, time-series
            charts, and tables will appear here. Widgets arrive in Phase 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Reports load instantly from cached data — dashboards never call the
          platform APIs directly.
        </CardContent>
      </Card>
    </div>
  );
}
