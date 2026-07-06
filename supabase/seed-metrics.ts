/**
 * Seeds ~35 days of realistic sample metrics for the demo client so the
 * dashboard can be exercised without live platform credentials.
 *
 *   npm run seed:metrics
 *
 * Idempotent: upserts on each table's primary key.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const svc = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DAYS = 70;
const CHANNELS = ["Organic Search", "Paid Search", "Direct", "Referral"];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
const rnd = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
};

async function main() {
  const { data: client } = await svc
    .from("clients")
    .select("id")
    .eq("slug", "demo-client")
    .single();
  if (!client) throw new Error("Demo client not found — run `npm run seed` first.");
  const clientId = client.id;

  // Credentials (fake vault ids — sample data only).
  const { data: gcred } = await svc
    .from("oauth_credentials")
    .upsert(
      { provider: "google", label: "Sample Google", vault_secret_id: crypto.randomUUID() },
      { onConflict: "id" },
    )
    .select("id")
    .single();
  const { data: mcred } = await svc
    .from("oauth_credentials")
    .insert({ provider: "meta", label: "Sample Meta", vault_secret_id: crypto.randomUUID() })
    .select("id")
    .single();

  async function source(sourceType: string, credId: string, externalId: string, name: string) {
    const { data } = await svc
      .from("data_sources")
      .upsert(
        {
          client_id: clientId,
          credential_id: credId,
          source: sourceType,
          external_id: externalId,
          display_name: name,
          config: { currency: "ZAR" },
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "client_id,source,external_id" },
      )
      .select("id")
      .single();
    return data!.id;
  }

  const ga4Id = await source("ga4", gcred!.id, "properties/900900900", "Demo GA4");
  const gscId = await source("gsc", gcred!.id, "sc-domain:demo.co.za", "demo.co.za");
  const gadsId = await source("google_ads", gcred!.id, "9009009009", "Demo Google Ads");
  const metaId = await source("meta_ads", mcred!.id, "act_900900900", "Demo Meta");

  const base = { client_id: clientId };

  // GA4
  const ga4Daily: Record<string, unknown>[] = [];
  const ga4Pages: Record<string, unknown>[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    let totalSessions = 0;
    let totalKey = 0;
    for (const ch of CHANNELS) {
      const sessions = rnd(20, 120);
      totalSessions += sessions;
      const key = rnd(0, 8);
      totalKey += key;
      ga4Daily.push({
        ...base, data_source_id: ga4Id, metric_date: date, channel: ch,
        sessions, total_users: Math.round(sessions * 0.85), new_users: Math.round(sessions * 0.4),
        engaged_sessions: Math.round(sessions * 0.7), engagement_rate: 0.7,
        key_events: key, total_revenue: key * rnd(200, 600),
      });
    }
    const desktop = Math.round(totalSessions * 0.6);
    const mobile = totalSessions - desktop;
    ga4Daily.push({
      ...base, data_source_id: ga4Id, metric_date: date, channel: "TOTAL",
      sessions: totalSessions, total_users: Math.round(totalSessions * 0.85),
      new_users: Math.round(totalSessions * 0.4), engaged_sessions: Math.round(totalSessions * 0.7),
      engagement_rate: 0.7, key_events: totalKey, total_revenue: totalKey * 400,
      device_split: { desktop: { sessions: desktop }, mobile: { sessions: mobile } },
    });
    for (const p of ["/", "/pricing", "/features", "/contact"]) {
      ga4Pages.push({
        ...base, data_source_id: ga4Id, metric_date: date, landing_page: p,
        sessions: rnd(10, 80), key_events: rnd(0, 5),
      });
    }
  }
  await svc.from("metrics_ga4_daily").upsert(ga4Daily, { onConflict: "data_source_id,metric_date,channel" });
  await svc.from("metrics_ga4_pages").upsert(ga4Pages, { onConflict: "data_source_id,metric_date,landing_page" });

  // GSC daily + weekly
  const gscDaily: Record<string, unknown>[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    const clicks = rnd(40, 160);
    const impressions = clicks * rnd(20, 40);
    gscDaily.push({
      ...base, data_source_id: gscId, metric_date: date, clicks, impressions,
      ctr: clicks / impressions, position: 5 + Math.random() * 6,
      device_split: { desktop: { clicks: Math.round(clicks * 0.55), impressions: Math.round(impressions * 0.55) }, mobile: { clicks: Math.round(clicks * 0.45), impressions: Math.round(impressions * 0.45) } },
      is_final: i > 3,
    });
  }
  await svc.from("metrics_gsc_daily").upsert(gscDaily, { onConflict: "data_source_id,metric_date" });

  const gscQueries: Record<string, unknown>[] = [];
  const gscPages: Record<string, unknown>[] = [];
  const weeks = new Set<string>();
  for (let i = 0; i < DAYS; i++) weeks.add(mondayOf(isoDaysAgo(i)));
  for (const ws of weeks) {
    for (const q of ["broadband deals", "fibre packages", "lte router", "uncapped wifi", "internet specials"]) {
      const clicks = rnd(20, 200);
      gscQueries.push({ ...base, data_source_id: gscId, week_start: ws, query: q, clicks, impressions: clicks * rnd(15, 35), position: 3 + Math.random() * 8 });
    }
    for (const p of ["/", "/deals", "/fibre", "/lte", "/coverage"]) {
      const clicks = rnd(20, 180);
      gscPages.push({ ...base, data_source_id: gscId, week_start: ws, page: `https://demo.co.za${p}`, clicks, impressions: clicks * rnd(15, 35), position: 3 + Math.random() * 8 });
    }
  }
  await svc.from("metrics_gsc_queries").upsert(gscQueries, { onConflict: "data_source_id,week_start,query" });
  await svc.from("metrics_gsc_pages").upsert(gscPages, { onConflict: "data_source_id,week_start,page" });

  // Google Ads
  const gadsRows: Record<string, unknown>[] = [];
  const gadsCampaigns = [
    ["101", "Search — Brand"],
    ["102", "Search — Generic"],
    ["103", "Performance Max"],
  ];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    let tImp = 0, tClk = 0, tCost = 0, tConv = 0, tVal = 0;
    for (const [id, name] of gadsCampaigns) {
      const impressions = rnd(500, 3000);
      const clicks = Math.round(impressions * (0.02 + Math.random() * 0.04));
      const cost = clicks * (2 + Math.random() * 6);
      const conversions = Math.round(clicks * (0.03 + Math.random() * 0.05));
      const value = conversions * rnd(300, 900);
      tImp += impressions; tClk += clicks; tCost += cost; tConv += conversions; tVal += value;
      gadsRows.push({ ...base, data_source_id: gadsId, metric_date: date, campaign_id: id, campaign_name: name, impressions, clicks, cost: Math.round(cost * 100) / 100, conversions, conversions_value: value });
    }
    gadsRows.push({ ...base, data_source_id: gadsId, metric_date: date, campaign_id: "TOTAL", campaign_name: null, impressions: tImp, clicks: tClk, cost: Math.round(tCost * 100) / 100, conversions: tConv, conversions_value: tVal });
  }
  await svc.from("metrics_gads_daily").upsert(gadsRows, { onConflict: "data_source_id,metric_date,campaign_id" });

  // Meta
  const metaRows: Record<string, unknown>[] = [];
  const metaCampaigns = [
    ["201", "Prospecting"],
    ["202", "Retargeting"],
  ];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    let tImp = 0, tClk = 0, tSpend = 0, tConv = 0;
    for (const [id, name] of metaCampaigns) {
      const impressions = rnd(3000, 12000);
      const clicks = Math.round(impressions * (0.01 + Math.random() * 0.03));
      const spend = clicks * (1.5 + Math.random() * 4);
      const conversions = Math.round(clicks * (0.02 + Math.random() * 0.05));
      tImp += impressions; tClk += clicks; tSpend += spend; tConv += conversions;
      metaRows.push({ ...base, data_source_id: metaId, metric_date: date, campaign_id: id, campaign_name: name, impressions, clicks, spend: Math.round(spend * 100) / 100, cpm: (spend / impressions) * 1000, cpc: spend / Math.max(clicks, 1), ctr: clicks / impressions, actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: String(conversions) }], conversions });
    }
    metaRows.push({ ...base, data_source_id: metaId, metric_date: date, campaign_id: "TOTAL", campaign_name: null, impressions: tImp, reach: Math.round(tImp * 0.7), clicks: tClk, spend: Math.round(tSpend * 100) / 100, cpm: (tSpend / tImp) * 1000, cpc: tSpend / Math.max(tClk, 1), ctr: tClk / tImp, actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: String(tConv) }], conversions: tConv });
  }
  await svc.from("metrics_meta_daily").upsert(metaRows, { onConflict: "data_source_id,metric_date,campaign_id" });

  console.log(`Sample metrics seeded for demo client (${DAYS} days, 4 sources).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
