import "server-only";
import { createHmac } from "node:crypto";
import { META_BASE } from "@/lib/constants";
import {
  metaMeSchema,
  metaTokenExchangeSchema,
  metaErrorSchema,
  metaInsightsResponseSchema,
  parseMetaAdAccountsPage,
  type MetaAdAccount,
} from "@/lib/integrations/meta/types";
import type { DateWindow } from "@/lib/sync/windows";

/**
 * Meta Graph/Marketing API client. All server calls include `appsecret_proof`
 * (HMAC-SHA256 of the access token keyed by the app secret) per doc 07.
 * Version is pinned via META_BASE (constants). Tokens are never logged.
 */

export class MetaApiError extends Error {
  code?: number;
  subcode?: number;
  constructor(message: string, code?: number, subcode?: number) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.subcode = subcode;
  }
}

export function appSecretProof(accessToken: string): string {
  return createHmac("sha256", process.env.META_APP_SECRET!)
    .update(accessToken)
    .digest("hex");
}

async function metaGet(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const url = new URL(`${META_BASE}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("appsecret_proof", appSecretProof(accessToken));

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (!res.ok) {
    const parsed = metaErrorSchema.safeParse(json);
    if (parsed.success) {
      throw new MetaApiError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.error_subcode,
      );
    }
    throw new MetaApiError(`Meta API error (HTTP ${res.status})`);
  }
  return json;
}

/** Validate a token by reading /me. Returns the business/user id + name. */
export async function validateMetaToken(
  accessToken: string,
): Promise<{ id: string; name?: string }> {
  const json = await metaGet("me", accessToken, { fields: "id,name" });
  return metaMeSchema.parse(json);
}

/**
 * Exchange the current token for a fresh long-lived (60-day) system-user token.
 * Uses client_id/secret (no appsecret_proof needed on the oauth endpoint).
 */
export async function exchangeForLongLivedToken(
  currentToken: string,
): Promise<{ accessToken: string; expiresIn: number | null }> {
  const url = new URL(`${META_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("set_token_expires_in_60_days", "true");
  url.searchParams.set("fb_exchange_token", currentToken);

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    const parsed = metaErrorSchema.safeParse(json);
    throw new MetaApiError(
      parsed.success
        ? parsed.data.error.message
        : `Meta token exchange failed (HTTP ${res.status})`,
      parsed.success ? parsed.data.error.code : undefined,
    );
  }
  const data = metaTokenExchangeSchema.parse(json);
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? null };
}

/** List ad accounts assigned to the system user (cursor-paginated). */
export async function listAdAccounts(
  accessToken: string,
): Promise<MetaAdAccount[]> {
  const out: MetaAdAccount[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      fields: "id,name,account_status,currency,timezone_name",
      limit: "100",
    };
    if (after) params.after = after;
    const json = await metaGet("me/adaccounts", accessToken, params);
    const page = parseMetaAdAccountsPage(json);
    out.push(...page.accounts);
    after = page.after;
  } while (after);

  return out;
}

const CAMPAIGN_FIELDS =
  "campaign_id,campaign_name,impressions,clicks,spend,cpm,cpc,ctr,reach,actions,date_start";
const ACCOUNT_FIELDS =
  "impressions,clicks,spend,cpm,cpc,ctr,reach,actions,date_start";

/**
 * Insights for an ad account over the window (doc 07). `time_increment=1` →
 * one row per day. Follows paging.next cursors and returns the combined
 * `{ data }` for normalizeMetaInsights. `level=account` yields TOTAL + reach.
 */
export async function fetchMetaInsights(
  accessToken: string,
  actId: string,
  window: DateWindow,
  level: "campaign" | "account",
): Promise<{ data: unknown[] }> {
  const first = new URL(`${META_BASE}/${actId}/insights`);
  first.searchParams.set("level", level);
  first.searchParams.set(
    "fields",
    level === "account" ? ACCOUNT_FIELDS : CAMPAIGN_FIELDS,
  );
  first.searchParams.set(
    "time_range",
    JSON.stringify({ since: window.start, until: window.end }),
  );
  first.searchParams.set("time_increment", "1");
  first.searchParams.set("limit", "500");
  first.searchParams.set("access_token", accessToken);
  first.searchParams.set("appsecret_proof", appSecretProof(accessToken));

  const data: unknown[] = [];
  let url: string | undefined = first.toString();

  while (url) {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      const parsed = metaErrorSchema.safeParse(json);
      if (parsed.success) {
        throw new MetaApiError(
          parsed.data.error.message,
          parsed.data.error.code,
          parsed.data.error.error_subcode,
        );
      }
      throw new MetaApiError(`Meta insights error (HTTP ${res.status})`);
    }
    const page = metaInsightsResponseSchema.parse(json);
    data.push(...page.data);
    url = page.paging?.next;
  }

  return { data };
}
