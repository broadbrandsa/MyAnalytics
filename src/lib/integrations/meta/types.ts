// Meta Ads (Marketing API) — zod schemas for API responses (CLAUDE.md rule #10)
// and normalized types. Sync-metric schemas are added in Phase 3.
import { z } from "zod";

/** GET /me?fields=id,name — token validation. */
export const metaMeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

/** GET /oauth/access_token — long-lived token exchange. */
export const metaTokenExchangeSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(), // seconds; may be absent for non-expiring
});

/** GET /me/adaccounts — one page. */
export const metaAdAccountSchema = z.object({
  id: z.string(), // "act_<ACCOUNT_ID>"
  name: z.string().optional(),
  account_status: z.number().optional(), // 1 = active
  currency: z.string().optional(),
  timezone_name: z.string().optional(),
});

export const metaAdAccountsPageSchema = z.object({
  data: z.array(metaAdAccountSchema),
  paging: z
    .object({
      next: z.string().optional(),
      cursors: z.object({ after: z.string().optional() }).optional(),
    })
    .optional(),
});

/** Meta error envelope. */
export const metaErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export type MetaAdAccount = z.infer<typeof metaAdAccountSchema>;

/** Pure parse of one /me/adaccounts page (unit-testable). */
export function parseMetaAdAccountsPage(json: unknown): {
  accounts: MetaAdAccount[];
  after?: string;
} {
  const page = metaAdAccountsPageSchema.parse(json);
  return {
    accounts: page.data,
    after: page.paging?.next ? page.paging?.cursors?.after : undefined,
  };
}

// --- Insights (act_{id}/insights) ---

const numeric = z.union([z.string(), z.number()]).optional();
const n = (v: string | number | undefined): number => {
  const x = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

const metaActionSchema = z.object({
  action_type: z.string(),
  value: z.union([z.string(), z.number()]).optional(),
});

const metaInsightRowSchema = z.object({
  date_start: z.string(),
  campaign_id: z.string().optional(),
  campaign_name: z.string().optional(),
  impressions: numeric,
  clicks: numeric,
  spend: numeric,
  cpm: numeric,
  cpc: numeric,
  ctr: numeric,
  reach: numeric,
  actions: z.array(metaActionSchema).optional(),
});

export const metaInsightsResponseSchema = z.object({
  data: z.array(metaInsightRowSchema),
  paging: z.object({ next: z.string().optional() }).optional(),
});

/** Default primary-action preference order for extracting `conversions`. */
export const DEFAULT_META_ACTIONS = [
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
  "lead",
  "offsite_conversion.fb_pixel_lead",
];

export interface MetaDailyRow {
  metric_date: string;
  campaign_id: string;
  campaign_name: string | null;
  impressions: number;
  reach: number | null;
  clicks: number;
  spend: number;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
  actions: { action_type: string; value?: string | number }[] | null;
  conversions: number;
}

function extractConversions(
  actions: { action_type: string; value?: string | number }[] | undefined,
  preference: string[],
): number {
  if (!actions?.length) return 0;
  for (const type of preference) {
    const hit = actions.find((a) => a.action_type === type);
    if (hit) return n(hit.value);
  }
  return 0;
}

/**
 * Normalizes an insights response (level=campaign or account) → metrics_meta
 * rows. Account-level rows become the TOTAL campaign row and are the only
 * reliable source of reach (not summable). `primaryAction` (from
 * data_sources.config.primary_action) is tried first for conversions.
 */
export function normalizeMetaInsights(
  json: unknown,
  level: "campaign" | "account",
  primaryAction?: string | null,
): MetaDailyRow[] {
  const parsed = metaInsightsResponseSchema.parse(json);
  const preference = primaryAction
    ? [primaryAction, ...DEFAULT_META_ACTIONS]
    : DEFAULT_META_ACTIONS;

  return parsed.data.map((r) => ({
    metric_date: r.date_start,
    campaign_id: level === "account" ? "TOTAL" : (r.campaign_id ?? "TOTAL"),
    campaign_name: level === "account" ? null : (r.campaign_name ?? null),
    impressions: n(r.impressions),
    reach: level === "account" ? n(r.reach) : null,
    clicks: n(r.clicks),
    spend: n(r.spend),
    cpm: r.cpm !== undefined ? n(r.cpm) : null,
    cpc: r.cpc !== undefined ? n(r.cpc) : null,
    ctr: r.ctr !== undefined ? n(r.ctr) : null,
    actions: r.actions ?? null,
    conversions: extractConversions(r.actions, preference),
  }));
}
