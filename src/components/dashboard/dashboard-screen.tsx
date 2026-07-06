import "server-only";
import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/service";
import { loadDashboard } from "@/lib/data/metrics";
import { resolveRange, type RangeParams } from "@/lib/dashboard/range";
import { fmtAgo } from "@/lib/dashboard/format";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import {
  DashboardView,
  type SectionSetting,
} from "@/components/dashboard/dashboard-view";
import type { ClientRow } from "@/lib/data/clients";

/**
 * Full client dashboard screen: branded header, date-range control, refresh,
 * "updated X ago", admin annotation note, and the data view. Reads only from
 * cached metrics (no platform API calls). Used by the code-gated /dashboard and
 * the admin "View as client" preview.
 */
export async function DashboardScreen({
  client,
  params,
  refreshClientId,
}: {
  client: ClientRow;
  params: RangeParams;
  refreshClientId?: string;
}) {
  const svc = createServiceClient();
  const { data: cfg } = await svc
    .from("dashboard_configs")
    .select("notes, config, default_date_range")
    .eq("client_id", client.id)
    .maybeSingle();

  const effParams: RangeParams = { ...params };
  if (!effParams.range && cfg?.default_date_range) {
    effParams.range = cfg.default_date_range;
  }
  const range = resolveRange(effParams);
  const data = await loadDashboard(client.id, range, client.currency);
  const sections = (cfg?.config as { sections?: SectionSetting[] } | null)
    ?.sections;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
              {data.lastSyncedAt
                ? `Data updated ${fmtAgo(data.lastSyncedAt)}`
                : "Not synced yet"}
            </p>
          </div>
        </div>
        <div className="print:hidden">
          <RefreshButton clientId={refreshClientId} />
        </div>
      </div>

      <div className="print:hidden">
        <DateRangePicker
          preset={range.preset}
          from={range.start}
          to={range.end}
          compare={range.compare}
        />
      </div>
      <p className="text-muted-foreground hidden text-sm print:block">
        {range.label} ({range.start} – {range.end})
      </p>

      {cfg?.notes && (
        <div className="bg-secondary text-secondary-foreground rounded-md px-4 py-3 text-sm">
          {cfg.notes}
        </div>
      )}

      <DashboardView data={data} sections={sections} />
    </div>
  );
}
