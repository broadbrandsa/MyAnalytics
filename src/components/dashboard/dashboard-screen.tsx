import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { loadDashboard } from "@/lib/data/metrics";
import { resolveRange, type RangeParams } from "@/lib/dashboard/range";
import { normalizeSections } from "@/lib/dashboard/sections";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { ClientRow } from "@/lib/data/clients";

/**
 * Full client dashboard (design direction 1a): left sidebar + a main column
 * with the date bar, refresh, and the data view. Reads only cached metrics.
 * `embedded` renders just the main column (for the admin "View as client"
 * preview, which already provides its own chrome + banner).
 */
export async function DashboardScreen({
  client,
  params,
  refreshClientId,
  embedded = false,
}: {
  client: ClientRow;
  params: RangeParams;
  refreshClientId?: string;
  embedded?: boolean;
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
  const sections = normalizeSections(
    (cfg?.config as { sections?: unknown } | null)?.sections,
  );

  const main = (
    <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <DateRangePicker
          preset={range.preset}
          from={range.start}
          to={range.end}
          compare={range.compare}
        />
        <RefreshButton clientId={refreshClientId} />
      </div>
      <p className="text-muted-foreground hidden text-sm print:block">
        {client.name} — {range.label} ({range.start} – {range.end})
      </p>

      {cfg?.notes && (
        <div className="bg-secondary text-secondary-foreground rounded-lg px-4 py-3 text-sm">
          {cfg.notes}
        </div>
      )}

      <DashboardView data={data} sections={sections} />
    </div>
  );

  if (embedded) return main;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1400px]">
      <DashboardSidebar
        clientName={client.name}
        brandColor={client.brand_color}
        connected={data.connected}
        lastSyncedAt={data.lastSyncedAt}
        sections={sections}
      />
      {main}
    </div>
  );
}
