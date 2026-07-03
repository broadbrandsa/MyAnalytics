/**
 * Response-parser fixtures per platform (CLAUDE.md testing priority #3).
 * Validates the zod schemas + flatten/filter logic against anonymized JSON
 * captured from each listing endpoint. Imports only from types.ts modules
 * (zod-only) so no `server-only` boundary is crossed in the node test env.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseGa4Properties } from "@/lib/integrations/ga4/types";
import { parseGscSites } from "@/lib/integrations/gsc/types";
import { parseGadsAccounts } from "@/lib/integrations/gads/types";
import { parseMetaAdAccountsPage } from "@/lib/integrations/meta/types";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, "fixtures", name), "utf8"),
  );
}

describe("GA4 accountSummaries parser", () => {
  test("flattens properties across accounts", () => {
    const { properties } = parseGa4Properties(
      fixture("ga4-account-summaries.json"),
    );
    expect(properties).toHaveLength(2);
    expect(properties[0]).toMatchObject({
      property: "properties/300000001",
      displayName: "Acme — Web",
      accountName: "Acme Group",
    });
  });
});

describe("GSC sites parser", () => {
  test("maps site entries", () => {
    const sites = parseGscSites(fixture("gsc-sites.json"));
    expect(sites).toHaveLength(2);
    expect(sites[0].siteUrl).toBe("sc-domain:acme.com");
  });
});

describe("Google Ads customer_client parser", () => {
  test("drops manager + non-ENABLED accounts and keeps currency", () => {
    const accounts = parseGadsAccounts(fixture("gads-search-stream.json"));
    // Only 1234567890 survives (2222222222 is a manager, 3333333333 is CANCELED).
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: "1234567890",
      descriptiveName: "Acme Retail",
      currencyCode: "ZAR",
    });
  });
});

describe("Meta adaccounts parser", () => {
  test("parses accounts and stops paging without paging.next", () => {
    const { accounts, after } = parseMetaAdAccountsPage(
      fixture("meta-adaccounts.json"),
    );
    expect(accounts).toHaveLength(2);
    expect(accounts[0].id).toBe("act_111111111");
    // Fixture has cursors.after but no paging.next → should not continue.
    expect(after).toBeUndefined();
  });
});
