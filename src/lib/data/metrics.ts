import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { ResolvedRange } from "@/lib/dashboard/range";
import type {
  DashboardData,
  Kpi,
  Ga4Data,
  AdsData,
  MetaData,
  GscData,
} from "@/lib/dashboard/types";
import type { Source } from "@/lib/constants";

/**
 * Reads cached metrics for a client + range and shapes them for the dashboard.
 * Service-role, but EVERY query is explicitly scoped to the given client_id
 * (the id comes from the verified access cookie / admin preview). Dashboards
 * never call platform APIs (CLAUDE.md hard rule #1).
 *
 * Strategy: pull TOTAL-level daily rows across [compareStart..end] once and
 * aggregate current + previous windows in JS; pull breakdown rows for the
 * current window only (tables/donuts).
 */

type Row = Record<string, unknown>;
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const inRange = (d: string, s: string, e: string) => d >= s && d <= e;
const sumBy = (rows: Row[], f: (r: Row) => number) =>
  rows.reduce((a, r) => a + f(r), 0);

export async function loadDashboard(
  clientId: string,
  range: ResolvedRange,
  currency: string,
): Promise<DashboardData> {
  const svc = createServiceClient();
  const { start, end, compareStart, compare } = range;

  // Which sources are connected + last sync.
  const { data: sources } = await svc
    .from("data_sources")
    .select("source, is_active, last_synced_at")
    .eq("client_id", clientId);
  const connected: Record<Source, boolean> = {
    ga4: false,
    gsc: false,
    google_ads: false,
    meta_ads: false,
  };
  let lastSyncedAt: string | null = null;
  for (const s of sources ?? []) {
    if (s.is_active) connected[s.source as Source] = true;
    if (s.last_synced_at && (!lastSyncedAt || s.last_synced_at > lastSyncedAt)) {
      lastSyncedAt = s.last_synced_at;
    }
  }

  const [ga4, gads, meta, gsc] = await Promise.all([
    connected.ga4 ? loadGa4(svc, clientId, range) : Promise.resolve(null),
    connected.google_ads
      ? loadAds(svc, clientId, range)
      : Promise.resolve(null),
    connected.meta_ads ? loadMeta(svc, clientId, range) : Promise.resolve(null),
    connected.gsc ? loadGsc(svc, clientId, range) : Promise.resolve(null),
  ]);

  // Combined overview.
  const mkKpi = (cur: number, prev: number): Kpi => ({
    value: cur,
    prev: compare ? prev : null,
  });
  const spend = mkKpi(
    (gads?.kpis.cost.value ?? 0) + (meta?.kpis.spend.value ?? 0),
    (gads?.kpis.cost.prev ?? 0) + (meta?.kpis.spend.prev ?? 0),
  );
  const conversions = mkKpi(
    (gads?.kpis.conversions.value ?? 0) + (meta?.kpis.conversions.value ?? 0),
    (gads?.kpis.conversions.prev ?? 0) + (meta?.kpis.conversions.prev ?? 0),
  );
  const revenue = ga4?.kpis.totalRevenue ?? mkKpi(0, 0);

  // Blended daily spend (Google Ads cost + Meta spend) for the overview trend.
  const spendByDate = new Map<string, number>();
  for (const p of gads?.series ?? [])
    spendByDate.set(p.date, (spendByDate.get(p.date) ?? 0) + p.cost);
  for (const p of meta?.series ?? [])
    spendByDate.set(p.date, (spendByDate.get(p.date) ?? 0) + p.spend);
  const spendSeries = [...spendByDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, s]) => ({ date, spend: Math.round(s * 100) / 100 }));

  // Paid spend split (donut).
  const spendByChannel = [
    { channel: "Google Ads", spend: gads?.kpis.cost.value ?? 0 },
    { channel: "Meta Ads", spend: meta?.kpis.spend.value ?? 0 },
  ].filter((c) => c.spend > 0);

  // Cross-channel comparison (connected sources only).
  const div = (a: number, b: number) => (b ? a / b : null);
  const channelComparison = [];
  if (gads) {
    channelComparison.push({
      channel: "Google Ads",
      spend: gads.kpis.cost.value,
      clicks: gads.kpis.clicks.value,
      conversions: gads.kpis.conversions.value,
      cpa: div(gads.kpis.cost.value, gads.kpis.conversions.value),
      roas: div(gads.kpis.conversionsValue.value, gads.kpis.cost.value),
    });
  }
  if (meta) {
    channelComparison.push({
      channel: "Meta Ads",
      spend: meta.kpis.spend.value,
      clicks: meta.kpis.clicks.value,
      conversions: meta.kpis.conversions.value,
      cpa: div(meta.kpis.spend.value, meta.kpis.conversions.value),
      roas: null, // Meta conversion value not captured
    });
  }
  if (ga4) {
    channelComparison.push({
      channel: "Google Analytics",
      spend: null,
      clicks: null,
      conversions: ga4.kpis.keyEvents.value,
      cpa: null,
      roas: null,
    });
  }
  if (gsc) {
    channelComparison.push({
      channel: "Search Console",
      spend: null,
      clicks: gsc.kpis.clicks.value,
      conversions: null,
      cpa: null,
      roas: null,
    });
  }

  return {
    connected,
    lastSyncedAt,
    currency,
    range: { start, end, label: range.label, compare },
    overview: {
      spend,
      conversions,
      revenue,
      sessions: ga4?.kpis.sessions ?? mkKpi(0, 0),
      keyEvents: ga4?.kpis.keyEvents ?? mkKpi(0, 0),
    },
    spendSeries,
    spendByChannel,
    channelComparison,
    ga4,
    gads,
    meta,
    gsc,
  };
  // silence unused in the no-compare branch
  void compareStart;
}

function kpiFromWindows(
  cur: Row[],
  prev: Row[],
  field: string,
  compare: boolean,
): Kpi {
  return {
    value: sumBy(cur, (r) => n(r[field])),
    prev: compare ? sumBy(prev, (r) => n(r[field])) : null,
  };
}

async function loadGa4(
  svc: ReturnType<typeof createServiceClient>,
  clientId: string,
  range: ResolvedRange,
): Promise<Ga4Data> {
  const { start, end, compareStart, compareEnd, compare } = range;

  const { data: totalRows } = await svc
    .from("metrics_ga4_daily")
    .select(
      "metric_date, sessions, total_users, new_users, engaged_sessions, key_events, total_revenue, device_split",
    )
    .eq("client_id", clientId)
    .eq("channel", "TOTAL")
    .gte("metric_date", compareStart)
    .lte("metric_date", end)
    .order("metric_date");

  const rows = (totalRows ?? []) as Row[];
  const cur = rows.filter((r) => inRange(r.metric_date as string, start, end));
  const prev = rows.filter((r) =>
    inRange(r.metric_date as string, compareStart, compareEnd),
  );

  const engRate = (w: Row[]): number => {
    const s = sumBy(w, (r) => n(r.sessions));
    return s ? (sumBy(w, (r) => n(r.engaged_sessions)) / s) * 100 : 0;
  };

  // Channel breakdown (current window, non-TOTAL) for the donut.
  const { data: chRows } = await svc
    .from("metrics_ga4_daily")
    .select("channel, sessions")
    .eq("client_id", clientId)
    .neq("channel", "TOTAL")
    .gte("metric_date", start)
    .lte("metric_date", end);
  const donutMap = new Map<string, number>();
  for (const r of (chRows ?? []) as Row[]) {
    const c = String(r.channel);
    donutMap.set(c, (donutMap.get(c) ?? 0) + n(r.sessions));
  }

  // Device split aggregated from TOTAL rows' jsonb.
  const deviceMap = new Map<string, number>();
  for (const r of cur) {
    const ds = r.device_split as Record<string, { sessions?: number }> | null;
    if (!ds) continue;
    for (const [dev, val] of Object.entries(ds)) {
      deviceMap.set(dev, (deviceMap.get(dev) ?? 0) + n(val?.sessions));
    }
  }

  // Landing pages (current window).
  const { data: pageRows } = await svc
    .from("metrics_ga4_pages")
    .select("landing_page, sessions, key_events")
    .eq("client_id", clientId)
    .gte("metric_date", start)
    .lte("metric_date", end);
  const pageMap = new Map<string, { sessions: number; keyEvents: number }>();
  for (const r of (pageRows ?? []) as Row[]) {
    const key = String(r.landing_page);
    const e = pageMap.get(key) ?? { sessions: 0, keyEvents: 0 };
    e.sessions += n(r.sessions);
    e.keyEvents += n(r.key_events);
    pageMap.set(key, e);
  }

  return {
    kpis: {
      sessions: kpiFromWindows(cur, prev, "sessions", compare),
      totalUsers: kpiFromWindows(cur, prev, "total_users", compare),
      newUsers: kpiFromWindows(cur, prev, "new_users", compare),
      keyEvents: kpiFromWindows(cur, prev, "key_events", compare),
      totalRevenue: kpiFromWindows(cur, prev, "total_revenue", compare),
      engagementRate: {
        value: engRate(cur),
        prev: compare ? engRate(prev) : null,
      },
    },
    sessionsSeries: cur.map((r) => ({
      date: r.metric_date as string,
      sessions: n(r.sessions),
    })),
    channelDonut: [...donutMap.entries()]
      .map(([channel, sessions]) => ({ channel, sessions }))
      .sort((a, b) => b.sessions - a.sessions),
    landingPages: [...pageMap.entries()]
      .map(([page, v]) => ({ page, ...v }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10),
    deviceSplit: [...deviceMap.entries()]
      .map(([device, sessions]) => ({ device, sessions }))
      .sort((a, b) => b.sessions - a.sessions),
  };
}

async function loadAds(
  svc: ReturnType<typeof createServiceClient>,
  clientId: string,
  range: ResolvedRange,
): Promise<AdsData> {
  const { start, end, compareStart, compareEnd, compare } = range;

  const { data: totalRows } = await svc
    .from("metrics_gads_daily")
    .select("metric_date, cost, impressions, clicks, conversions, conversions_value")
    .eq("client_id", clientId)
    .eq("campaign_id", "TOTAL")
    .gte("metric_date", compareStart)
    .lte("metric_date", end)
    .order("metric_date");
  const rows = (totalRows ?? []) as Row[];
  const cur = rows.filter((r) => inRange(r.metric_date as string, start, end));
  const prev = rows.filter((r) =>
    inRange(r.metric_date as string, compareStart, compareEnd),
  );

  const ratio = (num: number, den: number) => (den ? num / den : 0);
  const ctr = (w: Row[]) =>
    ratio(sumBy(w, (r) => n(r.clicks)), sumBy(w, (r) => n(r.impressions))) * 100;
  const cpc = (w: Row[]) =>
    ratio(sumBy(w, (r) => n(r.cost)), sumBy(w, (r) => n(r.clicks)));

  const { data: campRows } = await svc
    .from("metrics_gads_daily")
    .select("campaign_id, campaign_name, cost, impressions, clicks, conversions")
    .eq("client_id", clientId)
    .neq("campaign_id", "TOTAL")
    .gte("metric_date", start)
    .lte("metric_date", end);
  const campaigns = groupCampaigns(
    (campRows ?? []) as Row[],
    "cost",
  ).map((c) => ({
    id: c.id,
    name: c.name,
    cost: c.metrics.cost,
    impressions: c.metrics.impressions,
    clicks: c.metrics.clicks,
    conversions: c.metrics.conversions,
  }));

  return {
    kpis: {
      cost: kpiFromWindows(cur, prev, "cost", compare),
      impressions: kpiFromWindows(cur, prev, "impressions", compare),
      clicks: kpiFromWindows(cur, prev, "clicks", compare),
      conversions: kpiFromWindows(cur, prev, "conversions", compare),
      conversionsValue: kpiFromWindows(cur, prev, "conversions_value", compare),
      ctr: { value: ctr(cur), prev: compare ? ctr(prev) : null },
      cpc: { value: cpc(cur), prev: compare ? cpc(prev) : null },
    },
    series: cur.map((r) => ({
      date: r.metric_date as string,
      cost: n(r.cost),
      conversions: n(r.conversions),
    })),
    campaigns,
  };
}

async function loadMeta(
  svc: ReturnType<typeof createServiceClient>,
  clientId: string,
  range: ResolvedRange,
): Promise<MetaData> {
  const { start, end, compareStart, compareEnd, compare } = range;

  const { data: totalRows } = await svc
    .from("metrics_meta_daily")
    .select("metric_date, spend, impressions, reach, clicks, conversions")
    .eq("client_id", clientId)
    .eq("campaign_id", "TOTAL")
    .gte("metric_date", compareStart)
    .lte("metric_date", end)
    .order("metric_date");
  const rows = (totalRows ?? []) as Row[];
  const cur = rows.filter((r) => inRange(r.metric_date as string, start, end));
  const prev = rows.filter((r) =>
    inRange(r.metric_date as string, compareStart, compareEnd),
  );

  const ratio = (num: number, den: number) => (den ? num / den : 0);
  const ctr = (w: Row[]) =>
    ratio(sumBy(w, (r) => n(r.clicks)), sumBy(w, (r) => n(r.impressions))) * 100;
  const cpc = (w: Row[]) =>
    ratio(sumBy(w, (r) => n(r.spend)), sumBy(w, (r) => n(r.clicks)));
  const cpm = (w: Row[]) =>
    ratio(sumBy(w, (r) => n(r.spend)), sumBy(w, (r) => n(r.impressions))) * 1000;

  const { data: campRows } = await svc
    .from("metrics_meta_daily")
    .select("campaign_id, campaign_name, spend, impressions, clicks, conversions")
    .eq("client_id", clientId)
    .neq("campaign_id", "TOTAL")
    .gte("metric_date", start)
    .lte("metric_date", end);
  const campaigns = groupCampaigns((campRows ?? []) as Row[], "spend").map(
    (c) => ({
      id: c.id,
      name: c.name,
      spend: c.metrics.spend,
      impressions: c.metrics.impressions,
      clicks: c.metrics.clicks,
      conversions: c.metrics.conversions,
    }),
  );

  return {
    kpis: {
      spend: kpiFromWindows(cur, prev, "spend", compare),
      impressions: kpiFromWindows(cur, prev, "impressions", compare),
      // reach is not summable across days; daily sum is an approximation.
      reach: kpiFromWindows(cur, prev, "reach", compare),
      clicks: kpiFromWindows(cur, prev, "clicks", compare),
      conversions: kpiFromWindows(cur, prev, "conversions", compare),
      ctr: { value: ctr(cur), prev: compare ? ctr(prev) : null },
      cpc: { value: cpc(cur), prev: compare ? cpc(prev) : null },
      cpm: { value: cpm(cur), prev: compare ? cpm(prev) : null },
    },
    series: cur.map((r) => ({
      date: r.metric_date as string,
      spend: n(r.spend),
      conversions: n(r.conversions),
    })),
    campaigns,
  };
}

async function loadGsc(
  svc: ReturnType<typeof createServiceClient>,
  clientId: string,
  range: ResolvedRange,
): Promise<GscData> {
  const { start, end, compareStart, compareEnd, compare } = range;

  const { data: dailyRows } = await svc
    .from("metrics_gsc_daily")
    .select("metric_date, clicks, impressions, position")
    .eq("client_id", clientId)
    .gte("metric_date", compareStart)
    .lte("metric_date", end)
    .order("metric_date");
  const rows = (dailyRows ?? []) as Row[];
  const cur = rows.filter((r) => inRange(r.metric_date as string, start, end));
  const prev = rows.filter((r) =>
    inRange(r.metric_date as string, compareStart, compareEnd),
  );

  const ratio = (num: number, den: number) => (den ? num / den : 0);
  const ctr = (w: Row[]) =>
    ratio(sumBy(w, (r) => n(r.clicks)), sumBy(w, (r) => n(r.impressions))) * 100;
  // impression-weighted average position
  const pos = (w: Row[]) =>
    ratio(
      sumBy(w, (r) => n(r.position) * n(r.impressions)),
      sumBy(w, (r) => n(r.impressions)),
    );

  const queries = await topDimension(
    svc,
    "metrics_gsc_queries",
    "query",
    clientId,
    start,
    end,
  );
  const pages = await topDimension(
    svc,
    "metrics_gsc_pages",
    "page",
    clientId,
    start,
    end,
  );

  return {
    kpis: {
      clicks: kpiFromWindows(cur, prev, "clicks", compare),
      impressions: kpiFromWindows(cur, prev, "impressions", compare),
      ctr: { value: ctr(cur), prev: compare ? ctr(prev) : null },
      position: { value: pos(cur), prev: compare ? pos(prev) : null },
    },
    series: cur.map((r) => ({
      date: r.metric_date as string,
      clicks: n(r.clicks),
      impressions: n(r.impressions),
      position: n(r.position),
    })),
    queries: queries as GscData["queries"],
    pages: pages as GscData["pages"],
  };
}

// --- helpers ---

function groupCampaigns(rows: Row[], sortField: string) {
  const map = new Map<
    string,
    { id: string; name: string; metrics: Record<string, number> }
  >();
  for (const r of rows) {
    const id = String(r.campaign_id);
    const e =
      map.get(id) ??
      ({
        id,
        name: (r.campaign_name as string) ?? id,
        metrics: {},
      } as { id: string; name: string; metrics: Record<string, number> });
    for (const k of ["cost", "spend", "impressions", "clicks", "conversions"]) {
      if (r[k] !== undefined) e.metrics[k] = (e.metrics[k] ?? 0) + n(r[k]);
    }
    map.set(id, e);
  }
  return [...map.values()]
    .sort((a, b) => (b.metrics[sortField] ?? 0) - (a.metrics[sortField] ?? 0))
    .slice(0, 10);
}

async function topDimension(
  svc: ReturnType<typeof createServiceClient>,
  table: "metrics_gsc_queries" | "metrics_gsc_pages",
  dim: "query" | "page",
  clientId: string,
  start: string,
  end: string,
) {
  const { data } = await svc
    .from(table)
    .select(`${dim}, clicks, impressions, position, week_start`)
    .eq("client_id", clientId)
    .gte("week_start", start)
    .lte("week_start", end);
  const map = new Map<
    string,
    { clicks: number; impressions: number; posWeighted: number }
  >();
  for (const r of (data ?? []) as unknown as Row[]) {
    const key = String(r[dim]);
    const e = map.get(key) ?? { clicks: 0, impressions: 0, posWeighted: 0 };
    e.clicks += n(r.clicks);
    e.impressions += n(r.impressions);
    e.posWeighted += n(r.position) * n(r.impressions);
    map.set(key, e);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      [dim]: key,
      clicks: v.clicks,
      impressions: v.impressions,
      position: v.impressions ? v.posWeighted / v.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
}
