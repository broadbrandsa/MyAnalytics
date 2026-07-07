import "server-only";
import { GADS_BASE } from "@/lib/constants";
import { googleFetchJson, GoogleApiError } from "@/lib/integrations/shared/google-fetch";
import {
  parseGadsAccounts,
  parseGadsCustomer,
  gadsAccessibleSchema,
  type GadsAccount,
} from "@/lib/integrations/gads/types";
import type { DateWindow } from "@/lib/sync/windows";

const ENV_MCC = () =>
  (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/\D/g, "");

/**
 * Required headers on every Google Ads REST call (doc 06). login-customer-id is
 * the manager to act under — the MCC for accounts linked below it, or the
 * account itself for directly-accessible standalone accounts.
 */
function adsHeaders(loginCustomerId?: string): Record<string, string> {
  return {
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "login-customer-id": (loginCustomerId || ENV_MCC()).replace(/\D/g, ""),
  };
}

/** Customer ids the authorized user can access directly (no MCC needed). */
async function fetchAccessibleCustomerIds(
  accessToken: string,
): Promise<string[]> {
  const json = await googleFetchJson(
    `${GADS_BASE}/customers:listAccessibleCustomers`,
    accessToken,
    { headers: { "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN! } },
  );
  const parsed = gadsAccessibleSchema.parse(json);
  return (parsed.resourceNames ?? []).map((r) => r.replace("customers/", ""));
}

/** Read one customer's own info (name/currency/manager), acting as itself. */
async function fetchCustomerInfo(accessToken: string, customerId: string) {
  const json = await googleFetchJson(
    `${GADS_BASE}/customers/${customerId}/googleAds:searchStream`,
    accessToken,
    {
      method: "POST",
      headers: adsHeaders(customerId),
      body: JSON.stringify({
        query:
          "SELECT customer.id, customer.descriptive_name, customer.currency_code, " +
          "customer.time_zone, customer.manager, customer.status FROM customer",
      }),
    },
  );
  return parseGadsCustomer(json);
}

/** Expand a manager's client accounts (level <= 2), acting under that manager. */
async function fetchManagerChildren(
  accessToken: string,
  managerId: string,
): Promise<GadsAccount[]> {
  const json = await googleFetchJson(
    `${GADS_BASE}/customers/${managerId}/googleAds:searchStream`,
    accessToken,
    {
      method: "POST",
      headers: adsHeaders(managerId),
      body: JSON.stringify({
        query:
          "SELECT customer_client.id, customer_client.descriptive_name, " +
          "customer_client.manager, customer_client.status, " +
          "customer_client.currency_code, customer_client.time_zone " +
          "FROM customer_client WHERE customer_client.level <= 2",
      }),
    },
  );
  return parseGadsAccounts(json, managerId);
}

/**
 * Lists assignable Google Ads accounts. Walks every directly-accessible
 * customer: for managers (e.g. the MCC) it expands the client accounts beneath
 * them; standalone accounts are listed directly. Each account carries the
 * login-customer-id to use for it. One bad account doesn't sink the list.
 */
export async function listGadsAccounts(
  accessToken: string,
): Promise<GadsAccount[]> {
  const accessibleIds = await fetchAccessibleCustomerIds(accessToken);
  const byId = new Map<string, GadsAccount>();

  for (const id of accessibleIds) {
    try {
      const info = await fetchCustomerInfo(accessToken, id);
      if (info?.manager) {
        for (const child of await fetchManagerChildren(accessToken, id)) {
          byId.set(child.id, child);
        }
      } else if (info && (!info.status || info.status === "ENABLED")) {
        byId.set(info.id, {
          id: info.id,
          descriptiveName: info.descriptiveName ?? info.id,
          currencyCode: info.currencyCode,
          timeZone: info.timeZone,
          loginCustomerId: info.id,
        });
      }
    } catch (err) {
      // Skip accounts we can't read (permission/closed); keep listing the rest.
      if (!(err instanceof GoogleApiError)) throw err;
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.descriptiveName.localeCompare(b.descriptiveName),
  );
}

/**
 * Campaign performance for a customer over the window (doc 06). Acts under the
 * account's login-customer-id (MCC or the account itself).
 */
export function fetchGadsCampaignReport(
  accessToken: string,
  customerId: string,
  window: DateWindow,
  loginCustomerId?: string,
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
    {
      method: "POST",
      headers: adsHeaders(loginCustomerId),
      body: JSON.stringify({ query }),
    },
  );
}
