/**
 * Sync normalizers per platform (CLAUDE.md testing #3) — pure functions over
 * anonymized fixtures. No server-only boundary (imports from types.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { normalizeGa4 } from "@/lib/integrations/ga4/types";
import { normalizeGscDaily, normalizeGscDimension } from "@/lib/integrations/gsc/types";
import { normalizeGadsCampaigns } from "@/lib/integrations/gads/types";
import { normalizeMetaInsights } from "@/lib/integrations/meta/types";

const fx = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));

describe("GA4 normalize", () => {
  test("channel rows + TOTAL row with device split, plus pages", () => {
    const { daily, pages } = normalizeGa4(fx("ga4-batch-report.json"));
    const channels = daily.filter((r) => r.channel !== "TOTAL");
    const total = daily.find((r) => r.channel === "TOTAL");
    expect(channels).toHaveLength(2);
    expect(total).toBeTruthy();
    expect(total!.metric_date).toBe("2026-07-01");
    expect(total!.sessions).toBe(200);
    expect(total!.device_split).toEqual({
      desktop: { sessions: 130 },
      mobile: { sessions: 70 },
    });
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ landing_page: "/home", sessions: 150 });
  });
});

describe("GSC normalize", () => {
  test("daily rows carry device split and is_final", () => {
    const rows = normalizeGscDaily(
      fx("gsc-daily.json"),
      fx("gsc-device.json"),
      "2026-07-03",
    );
    expect(rows).toHaveLength(2);
    const first = rows.find((r) => r.metric_date === "2026-06-25")!;
    expect(first.clicks).toBe(120);
    expect(first.is_final).toBe(true); // 06-25 <= 07-03 minus 4 = 06-29
    expect(first.device_split).toMatchObject({ desktop: { clicks: 70 } });
  });

  test("weekly query rollup maps to week_start", () => {
    const rows = normalizeGscDimension(
      fx("gsc-queries.json"),
      "2026-06-22",
      "query",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      week_start: "2026-06-22",
      query: "broadband packages",
      clicks: 210,
    });
  });
});

describe("Google Ads normalize", () => {
  test("cost_micros→cost and a summed TOTAL row", () => {
    const rows = normalizeGadsCampaigns(fx("gads-campaign-report.json"));
    const campaigns = rows.filter((r) => r.campaign_id !== "TOTAL");
    const total = rows.find((r) => r.campaign_id === "TOTAL")!;
    expect(campaigns).toHaveLength(2);
    expect(campaigns[0].cost).toBeCloseTo(45); // 45,000,000 / 1e6
    expect(total.impressions).toBe(2000);
    expect(total.cost).toBeCloseTo(70);
    expect(total.conversions).toBeCloseTo(10);
  });
});

describe("Meta normalize", () => {
  test("campaign rows extract conversions from pixel purchase", () => {
    const rows = normalizeMetaInsights(
      fx("meta-insights-campaign.json"),
      "campaign",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      campaign_id: "600001",
      spend: 1250.75,
      conversions: 12,
    });
    // reach only reliable at account level → null for campaign rows.
    expect(rows[0].reach).toBeNull();
  });

  test("account level yields TOTAL rows with reach", () => {
    const rows = normalizeMetaInsights(
      {
        data: [
          {
            date_start: "2026-07-01",
            impressions: "23000",
            reach: "18000",
            clicks: "530",
            spend: "1890.95",
            actions: [
              { action_type: "offsite_conversion.fb_pixel_purchase", value: "21" },
            ],
          },
        ],
      },
      "account",
    );
    expect(rows[0].campaign_id).toBe("TOTAL");
    expect(rows[0].reach).toBe(18000);
    expect(rows[0].conversions).toBe(21);
  });
});
