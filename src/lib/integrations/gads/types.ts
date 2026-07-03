// Google Ads (REST) — zod schemas + pure normalizers.
import { z } from "zod";

/** int64 fields arrive as strings, doubles as numbers. */
const num = (v: string | number | undefined): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const numeric = z.union([z.string(), z.number()]).optional();

/**
 * customer_client rows from googleAds:searchStream. REST returns lowerCamelCase
 * keys; numeric ids arrive as strings.
 */
export const gadsCustomerClientSchema = z.object({
  id: z.string(), // 10-digit customer id
  descriptiveName: z.string().optional(),
  manager: z.boolean().optional(),
  status: z.string().optional(), // ENABLED, CANCELED, ...
  currencyCode: z.string().optional(),
  timeZone: z.string().optional(),
});

export const gadsSearchStreamResponseSchema = z.array(
  z.object({
    results: z
      .array(z.object({ customerClient: gadsCustomerClientSchema }))
      .optional(),
  }),
);

export interface GadsAccount {
  id: string; // external_id, 10-digit
  descriptiveName: string;
  currencyCode: string | null;
  timeZone: string | null;
}

/**
 * Pure parse+filter of a customer_client searchStream response
 * (unit-testable): drops manager accounts and non-ENABLED accounts, dedupes.
 */
export function parseGadsAccounts(json: unknown): GadsAccount[] {
  const chunks = gadsSearchStreamResponseSchema.parse(json);
  const seen = new Set<string>();
  const out: GadsAccount[] = [];

  for (const chunk of chunks) {
    for (const row of chunk.results ?? []) {
      const cc = row.customerClient;
      if (cc.manager) continue; // skip sub-MCCs
      if (cc.status && cc.status !== "ENABLED") continue;
      if (seen.has(cc.id)) continue;
      seen.add(cc.id);
      out.push({
        id: cc.id,
        descriptiveName: cc.descriptiveName ?? cc.id,
        currencyCode: cc.currencyCode ?? null,
        timeZone: cc.timeZone ?? null,
      });
    }
  }
  return out;
}

// --- Campaign report (googleAds:searchStream) ---

const gadsReportRowSchema = z.object({
  segments: z.object({ date: z.string() }),
  campaign: z
    .object({ id: z.string(), name: z.string().optional() })
    .optional(),
  metrics: z
    .object({
      impressions: numeric,
      clicks: numeric,
      costMicros: numeric,
      conversions: numeric,
      conversionsValue: numeric,
    })
    .optional(),
});

export const gadsReportResponseSchema = z.array(
  z.object({ results: z.array(gadsReportRowSchema).optional() }),
);

export interface GadsDailyRow {
  metric_date: string;
  campaign_id: string;
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversions_value: number;
}

/**
 * Normalizes a campaign searchStream response → per-campaign rows plus a
 * summed TOTAL row per date (all these metrics are summable). Money:
 * cost_micros / 1e6 at write time (CLAUDE.md hard rule #9).
 */
export function normalizeGadsCampaigns(json: unknown): GadsDailyRow[] {
  const chunks = gadsReportResponseSchema.parse(json);
  const perCampaign: GadsDailyRow[] = [];
  const totals: Record<string, GadsDailyRow> = {};

  for (const chunk of chunks) {
    for (const row of chunk.results ?? []) {
      const date = row.segments.date;
      const m = row.metrics ?? {};
      const rec: GadsDailyRow = {
        metric_date: date,
        campaign_id: row.campaign?.id ?? "UNKNOWN",
        campaign_name: row.campaign?.name ?? null,
        impressions: num(m.impressions),
        clicks: num(m.clicks),
        cost: num(m.costMicros) / 1_000_000,
        conversions: num(m.conversions),
        conversions_value: num(m.conversionsValue),
      };
      perCampaign.push(rec);

      const t = (totals[date] ??= {
        metric_date: date,
        campaign_id: "TOTAL",
        campaign_name: null,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        conversions_value: 0,
      });
      t.impressions += rec.impressions;
      t.clicks += rec.clicks;
      t.cost += rec.cost;
      t.conversions += rec.conversions;
      t.conversions_value += rec.conversions_value;
    }
  }

  return [...perCampaign, ...Object.values(totals)];
}
