import "server-only";
import { GSC_BASE } from "@/lib/constants";
import { googleFetchJson } from "@/lib/integrations/shared/google-fetch";
import { parseGscSites, type GscSite } from "@/lib/integrations/gsc/types";
import type { DateWindow } from "@/lib/sync/windows";

/**
 * Lists Search Console sites the agency identity can access. Store `siteUrl`
 * (e.g. "sc-domain:example.com") as external_id; URL-encode it in later request
 * paths (doc 05).
 */
export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const json = await googleFetchJson(`${GSC_BASE}/sites`, accessToken);
  return parseGscSites(json);
}

function queryUrl(siteUrl: string): string {
  return `${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
}

async function runQuery(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return googleFetchJson(queryUrl(siteUrl), accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Daily totals by date (dataState "all" → fresh-but-revisable). */
export function fetchGscDaily(
  accessToken: string,
  siteUrl: string,
  window: DateWindow,
): Promise<unknown> {
  return runQuery(accessToken, siteUrl, {
    startDate: window.start,
    endDate: window.end,
    dimensions: ["date"],
    type: "web",
    dataState: "all",
    rowLimit: 25000,
  });
}

/** Daily totals split by device. */
export function fetchGscDevice(
  accessToken: string,
  siteUrl: string,
  window: DateWindow,
): Promise<unknown> {
  return runQuery(accessToken, siteUrl, {
    startDate: window.start,
    endDate: window.end,
    dimensions: ["date", "device"],
    type: "web",
    dataState: "all",
    rowLimit: 25000,
  });
}

/** One week of a query/page rollup (dataState "final"). */
export function fetchGscDimension(
  accessToken: string,
  siteUrl: string,
  week: DateWindow,
  dimension: "query" | "page",
): Promise<unknown> {
  return runQuery(accessToken, siteUrl, {
    startDate: week.start,
    endDate: week.end,
    dimensions: [dimension],
    type: "web",
    dataState: "final",
    rowLimit: 1000,
  });
}
