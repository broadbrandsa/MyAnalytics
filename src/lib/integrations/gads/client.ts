import "server-only";
import { GADS_BASE } from "@/lib/constants";
import { googleFetchJson } from "@/lib/integrations/shared/google-fetch";
import { parseGadsAccounts, type GadsAccount } from "@/lib/integrations/gads/types";
import type { DateWindow } from "@/lib/sync/windows";

/**
 * Required headers on every Google Ads REST call (doc 06). login-customer-id is
 * the Broadbrand MCC (digits only); the developer token comes from the MCC's
 * API Center.
 */
function adsHeaders(): Record<string, string> {
  return {
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "login-customer-id": (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(
      /\D/g,
      "",
    ),
  };
}

/**
 * Lists client accounts under the Broadbrand MCC via a customer_client GAQL
 * query (level <= 2). Manager accounts are filtered out. currency_code comes
 * back with each account, so we capture it here for storage at assignment
 * (doc 06 — don't aggregate across currencies).
 */
export async function listGadsAccounts(
  accessToken: string,
): Promise<GadsAccount[]> {
  const mcc = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/\D/g, "");
  if (!mcc) throw new Error("GOOGLE_ADS_LOGIN_CUSTOMER_ID is not configured.");

  const url = `${GADS_BASE}/customers/${mcc}/googleAds:searchStream`;
  const query =
    "SELECT customer_client.id, customer_client.descriptive_name, " +
    "customer_client.manager, customer_client.status, " +
    "customer_client.currency_code, customer_client.time_zone " +
    "FROM customer_client WHERE customer_client.level <= 2";

  const json = await googleFetchJson(url, accessToken, {
    method: "POST",
    headers: adsHeaders(),
    body: JSON.stringify({ query }),
  });

  return parseGadsAccounts(json);
}

/**
 * Campaign performance for a customer over the window (doc 06). One
 * searchStream call; returns the raw chunk array for normalizeGadsCampaigns.
 */
export function fetchGadsCampaignReport(
  accessToken: string,
  customerId: string,
  window: DateWindow,
): Promise<unknown> {
  const id = customerId.replace(/\D/g, "");
  const query =
    "SELECT segments.date, campaign.id, campaign.name, " +
    "metrics.impressions, metrics.clicks, metrics.cost_micros, " +
    "metrics.conversions, metrics.conversions_value " +
    `FROM campaign WHERE segments.date BETWEEN '${window.start}' AND '${window.end}' ` +
    "ORDER BY segments.date";

  return googleFetchJson(
    `${GADS_BASE}/customers/${id}/googleAds:searchStream`,
    accessToken,
    { method: "POST", headers: adsHeaders(), body: JSON.stringify({ query }) },
  );
}
