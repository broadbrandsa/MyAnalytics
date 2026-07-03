import "server-only";
import { GA4_ADMIN_BASE, GA4_DATA_BASE } from "@/lib/constants";
import { googleFetchJson } from "@/lib/integrations/shared/google-fetch";
import {
  parseGa4Properties,
  type Ga4Property,
} from "@/lib/integrations/ga4/types";
import type { DateWindow } from "@/lib/sync/windows";

/**
 * Lists GA4 properties visible to the agency Google identity, flattened from
 * accountSummaries (paginated). Store `property` ("properties/123456") as
 * data_sources.external_id.
 */
export async function listGa4Properties(
  accessToken: string,
): Promise<Ga4Property[]> {
  const out: Ga4Property[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GA4_ADMIN_BASE}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const json = await googleFetchJson(url.toString(), accessToken);
    const { properties, nextPageToken } = parseGa4Properties(json);
    out.push(...properties);
    pageToken = nextPageToken;
  } while (pageToken);

  return out;
}

const CORE_METRICS = [
  { name: "sessions" },
  { name: "totalUsers" },
  { name: "newUsers" },
  { name: "engagedSessions" },
  { name: "engagementRate" },
  { name: "keyEvents" },
  { name: "totalRevenue" },
];

/**
 * One batchRunReports call returns the four reports normalizeGa4() expects, in
 * order: [date×channel, date totals, date×landingPage, date×device]. Uses
 * keyEvents (conversions is deprecated) and returnPropertyQuota for telemetry.
 */
export async function fetchGa4Reports(
  accessToken: string,
  property: string,
  window: DateWindow,
): Promise<unknown> {
  const dateRanges = [{ startDate: window.start, endDate: window.end }];
  const body = {
    requests: [
      {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
        metrics: CORE_METRICS,
        limit: 100000,
        returnPropertyQuota: true,
      },
      {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: CORE_METRICS,
        limit: 100000,
      },
      {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "landingPage" }],
        metrics: [{ name: "sessions" }, { name: "keyEvents" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10000,
      },
      {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        limit: 10000,
      },
    ],
  };

  return googleFetchJson(
    `${GA4_DATA_BASE}/${property}:batchRunReports`,
    accessToken,
    { method: "POST", body: JSON.stringify(body) },
  );
}
