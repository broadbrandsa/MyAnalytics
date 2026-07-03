/**
 * Sync idempotency (CLAUDE.md testing #2): upserting the same normalized window
 * twice must not change row counts or values. Runs the real upsert path against
 * local Supabase with a GA4 fixture.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, afterAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizeGa4 } from "@/lib/integrations/ga4/types";
import { upsertRows } from "@/lib/sync/upsert";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const svc = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN = Date.now().toString(36);
let clientId: string;
let dataSourceId: string;

const fx = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));

beforeAll(async () => {
  const { data: client } = await svc
    .from("clients")
    .insert({ name: `Idem ${RUN}`, slug: `idem-${RUN}` })
    .select("id")
    .single();
  clientId = client!.id;

  const { data: cred } = await svc
    .from("oauth_credentials")
    .insert({
      provider: "google",
      label: `idem-${RUN}`,
      vault_secret_id: crypto.randomUUID(),
    })
    .select("id")
    .single();

  const { data: ds } = await svc
    .from("data_sources")
    .insert({
      client_id: clientId,
      credential_id: cred!.id,
      source: "ga4",
      external_id: `properties/${RUN}`,
      display_name: "Idem GA4",
    })
    .select("id")
    .single();
  dataSourceId = ds!.id;
});

afterAll(async () => {
  if (clientId) await svc.from("clients").delete().eq("id", clientId);
});

async function upsertWindow(client: SupabaseClient<Database>) {
  const { daily } = normalizeGa4(fx("ga4-batch-report.json"));
  const rows = daily.map((r) => ({
    data_source_id: dataSourceId,
    client_id: clientId,
    ...r,
  }));
  return upsertRows(
    client as never,
    "metrics_ga4_daily",
    rows,
    "data_source_id,metric_date,channel",
  );
}

async function snapshot() {
  const { data, count } = await svc
    .from("metrics_ga4_daily")
    .select("channel, sessions", { count: "exact" })
    .eq("data_source_id", dataSourceId)
    .order("channel");
  return { count: count ?? 0, rows: data ?? [] };
}

describe("GA4 sync idempotency", () => {
  test("re-running the same window changes no rows or values", async () => {
    await upsertWindow(svc);
    const first = await snapshot();

    await upsertWindow(svc); // run again
    const second = await snapshot();

    expect(second.count).toBe(first.count);
    expect(second.rows).toEqual(first.rows);

    // Spot-check: TOTAL sessions is 200, not doubled.
    const total = second.rows.find((r) => r.channel === "TOTAL");
    expect(Number(total?.sessions)).toBe(200);
  });
});
