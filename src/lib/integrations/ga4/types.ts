// GA4 (Analytics Data/Admin API) — zod schemas + pure normalizers.
import { z } from "zod";

/** value helpers: GA4 returns all metric/dimension values as strings. */
const num = (s: string | undefined): number => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
/** "20260701" → "2026-07-01" */
const isoDate = (yyyymmdd: string): string =>
  `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

/** GET analyticsadmin/v1beta/accountSummaries */
export const ga4PropertySummarySchema = z.object({
  property: z.string(), // "properties/123456"
  displayName: z.string().optional(),
  propertyType: z.string().optional(),
});

export const ga4AccountSummarySchema = z.object({
  account: z.string().optional(), // "accounts/123"
  displayName: z.string().optional(),
  propertySummaries: z.array(ga4PropertySummarySchema).optional(),
});

export const ga4AccountSummariesSchema = z.object({
  accountSummaries: z.array(ga4AccountSummarySchema).optional(),
  nextPageToken: z.string().optional(),
});

export interface Ga4Property {
  property: string; // external_id, e.g. "properties/123456"
  displayName: string;
  accountName: string;
}

/** Pure parse+flatten of one accountSummaries page (unit-testable). */
export function parseGa4Properties(json: unknown): {
  properties: Ga4Property[];
  nextPageToken?: string;
} {
  const parsed = ga4AccountSummariesSchema.parse(json);
  const properties: Ga4Property[] = [];
  for (const acc of parsed.accountSummaries ?? []) {
    for (const prop of acc.propertySummaries ?? []) {
      properties.push({
        property: prop.property,
        displayName: prop.displayName ?? prop.property,
        accountName: acc.displayName ?? acc.account ?? "",
      });
    }
  }
  return { properties, nextPageToken: parsed.nextPageToken };
}

// --- Report schemas (runReport / batchRunReports) ---

const ga4RowSchema = z.object({
  dimensionValues: z.array(z.object({ value: z.string() })).optional(),
  metricValues: z.array(z.object({ value: z.string() })).optional(),
});
const ga4ReportSchema = z.object({
  dimensionHeaders: z.array(z.object({ name: z.string() })).optional(),
  metricHeaders: z.array(z.object({ name: z.string() })).optional(),
  rows: z.array(ga4RowSchema).optional(),
  rowCount: z.number().optional(),
});
export const ga4BatchSchema = z.object({
  reports: z.array(ga4ReportSchema),
  // propertyQuota is echoed per-report when returnPropertyQuota=true
});

type Ga4Report = z.infer<typeof ga4ReportSchema>;

/** Index a report's rows into {dims, mets} keyed by header name. */
function records(report: Ga4Report): {
  dims: Record<string, string>;
  mets: Record<string, string>;
}[] {
  const dimNames = (report.dimensionHeaders ?? []).map((h) => h.name);
  const metNames = (report.metricHeaders ?? []).map((h) => h.name);
  return (report.rows ?? []).map((r) => {
    const dims: Record<string, string> = {};
    dimNames.forEach((n, i) => (dims[n] = r.dimensionValues?.[i]?.value ?? ""));
    const mets: Record<string, string> = {};
    metNames.forEach((n, i) => (mets[n] = r.metricValues?.[i]?.value ?? "0"));
    return { dims, mets };
  });
}

export interface Ga4DailyRow {
  metric_date: string;
  channel: string;
  sessions: number;
  total_users: number;
  new_users: number;
  engaged_sessions: number;
  engagement_rate: number | null;
  key_events: number;
  total_revenue: number;
  device_split: Record<string, { sessions: number }> | null;
}

export interface Ga4PageRow {
  metric_date: string;
  landing_page: string;
  sessions: number;
  key_events: number;
}

function metricsToDaily(
  mets: Record<string, string>,
  metric_date: string,
  channel: string,
): Ga4DailyRow {
  return {
    metric_date,
    channel,
    sessions: num(mets.sessions),
    total_users: num(mets.totalUsers),
    new_users: num(mets.newUsers),
    engaged_sessions: num(mets.engagedSessions),
    engagement_rate: mets.engagementRate ? num(mets.engagementRate) : null,
    key_events: num(mets.keyEvents),
    total_revenue: num(mets.totalRevenue),
    device_split: null,
  };
}

/**
 * Normalizes a batchRunReports response in the documented order:
 *   [0] date × channel, [1] date totals, [2] date × landingPage, [3] date × device
 * → metrics_ga4_daily rows (channel rows + TOTAL rows w/ device_split) and
 *   metrics_ga4_pages rows.
 */
export function normalizeGa4(batchJson: unknown): {
  daily: Ga4DailyRow[];
  pages: Ga4PageRow[];
} {
  const { reports } = ga4BatchSchema.parse(batchJson);
  const [channelR, totalsR, pagesR, deviceR] = reports;

  const daily: Ga4DailyRow[] = [];

  // Channel rows
  for (const { dims, mets } of records(channelR ?? {})) {
    const date = isoDate(dims.date);
    const channel = dims.sessionDefaultChannelGroup || "(not set)";
    daily.push(metricsToDaily(mets, date, channel));
  }

  // Device split aggregated per date
  const deviceByDate: Record<string, Record<string, { sessions: number }>> = {};
  for (const { dims, mets } of records(deviceR ?? {})) {
    const date = isoDate(dims.date);
    const dev = (dims.deviceCategory || "unknown").toLowerCase();
    (deviceByDate[date] ??= {})[dev] = { sessions: num(mets.sessions) };
  }

  // TOTAL rows (with device split attached)
  for (const { dims, mets } of records(totalsR ?? {})) {
    const date = isoDate(dims.date);
    const row = metricsToDaily(mets, date, "TOTAL");
    row.device_split = deviceByDate[date] ?? null;
    daily.push(row);
  }

  // Landing pages
  const pages: Ga4PageRow[] = [];
  for (const { dims, mets } of records(pagesR ?? {})) {
    pages.push({
      metric_date: isoDate(dims.date),
      landing_page: dims.landingPage || "(not set)",
      sessions: num(mets.sessions),
      key_events: num(mets.keyEvents),
    });
  }

  return { daily, pages };
}
