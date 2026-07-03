// Google Search Console — zod schemas + pure normalizers.
import { z } from "zod";
import { shiftDate } from "@/lib/sync/windows";

/** GET webmasters/v3/sites */
export const gscSiteEntrySchema = z.object({
  siteUrl: z.string(), // "sc-domain:example.com" or a URL prefix
  permissionLevel: z.string().optional(),
});

export const gscSitesListSchema = z.object({
  siteEntry: z.array(gscSiteEntrySchema).optional(),
});

export interface GscSite {
  siteUrl: string; // external_id
  permissionLevel: string;
}

/** Pure parse of the sites.list response (unit-testable). */
export function parseGscSites(json: unknown): GscSite[] {
  const parsed = gscSitesListSchema.parse(json);
  return (parsed.siteEntry ?? []).map((s) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel ?? "",
  }));
}

// --- searchAnalytics.query response ---

export const gscQueryResponseSchema = z.object({
  rows: z
    .array(
      z.object({
        keys: z.array(z.string()).optional(),
        clicks: z.number().optional(),
        impressions: z.number().optional(),
        ctr: z.number().optional(),
        position: z.number().optional(),
      }),
    )
    .optional(),
});

export interface GscDailyRow {
  metric_date: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
  device_split: Record<
    string,
    { clicks: number; impressions: number }
  > | null;
  is_final: boolean;
}

export interface GscDimensionRow {
  week_start: string;
  clicks: number;
  impressions: number;
  position: number | null;
  query?: string;
  page?: string;
}

/**
 * Daily totals (+ device split merged) → metrics_gsc_daily.
 * `is_final` = metric_date <= today-4 days (GSC finalizes ~3 days late).
 */
export function normalizeGscDaily(
  dailyJson: unknown,
  deviceJson: unknown,
  todayIso: string,
): GscDailyRow[] {
  const daily = gscQueryResponseSchema.parse(dailyJson);
  const device = gscQueryResponseSchema.parse(deviceJson);
  const finalCutoff = shiftDate(todayIso, -4);

  const byDate: Record<
    string,
    Record<string, { clicks: number; impressions: number }>
  > = {};
  for (const r of device.rows ?? []) {
    const date = r.keys?.[0];
    const dev = (r.keys?.[1] ?? "unknown").toLowerCase();
    if (!date) continue;
    (byDate[date] ??= {})[dev] = {
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
    };
  }

  return (daily.rows ?? []).flatMap((r) => {
    const date = r.keys?.[0];
    if (!date) return [];
    return [
      {
        metric_date: date,
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? null,
        position: r.position ?? null,
        device_split: byDate[date] ?? null,
        is_final: date <= finalCutoff,
      },
    ];
  });
}

/** Weekly query/page rollup → metrics_gsc_queries / metrics_gsc_pages. */
export function normalizeGscDimension(
  json: unknown,
  weekStartDate: string,
  dimension: "query" | "page",
): GscDimensionRow[] {
  const parsed = gscQueryResponseSchema.parse(json);
  return (parsed.rows ?? []).flatMap((r) => {
    const key = r.keys?.[0];
    if (!key) return [];
    return [
      {
        week_start: weekStartDate,
        [dimension]: key,
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        position: r.position ?? null,
      } as GscDimensionRow,
    ];
  });
}
