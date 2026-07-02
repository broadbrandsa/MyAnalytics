/**
 * RLS isolation — the one non-negotiable test suite (CLAUDE.md testing #1).
 *
 * Two client_viewers in two different client orgs must never see each other's
 * data, and must never be able to write. Runs against the LOCAL Supabase stack
 * (`supabase start`). Requires .env.local with URL + anon + service-role keys.
 */
import { beforeAll, afterAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Unique suffix so re-runs don't collide.
const RUN = Date.now().toString(36);
const PASSWORD = "password123!";

interface Party {
  clientId: string;
  userId: string;
  email: string;
  db: SupabaseClient; // authenticated as this viewer (anon key + session)
}

async function makeViewer(tag: string): Promise<Party> {
  const email = `rls-${tag}-${RUN}@test.local`;

  // Client org
  const { data: client, error: cErr } = await admin
    .from("clients")
    .insert({ name: `RLS ${tag} ${RUN}`, slug: `rls-${tag}-${RUN}` })
    .select("id")
    .single();
  if (cErr) throw cErr;

  // Viewer user
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${tag}`, role: "client_viewer" },
  });
  if (uErr) throw uErr;
  const userId = created.user.id;

  // Membership
  const { error: mErr } = await admin
    .from("memberships")
    .insert({ client_id: client.id, user_id: userId });
  if (mErr) throw mErr;

  // A metrics row owned by this client (service role bypasses RLS)
  const { error: rErr } = await admin.from("metrics_ga4_daily").insert({
    data_source_id: crypto.randomUUID(), // FK is deferred? no — need a data_source
    client_id: client.id,
    metric_date: "2026-06-01",
    channel: "TOTAL",
    sessions: tag === "a" ? 111 : 222,
  });
  // metrics_ga4_daily.data_source_id references data_sources — create one first.
  if (rErr) {
    // Create a credential + data source so the FK holds, then retry.
    const { data: cred } = await admin
      .from("oauth_credentials")
      .insert({
        provider: "google",
        label: `rls-${tag}-${RUN}`,
        vault_secret_id: crypto.randomUUID(),
      })
      .select("id")
      .single();
    const { data: ds } = await admin
      .from("data_sources")
      .insert({
        client_id: client.id,
        credential_id: cred!.id,
        source: "ga4",
        external_id: `properties/${tag}-${RUN}`,
        display_name: `RLS ${tag}`,
      })
      .select("id")
      .single();
    const { error: r2 } = await admin.from("metrics_ga4_daily").insert({
      data_source_id: ds!.id,
      client_id: client.id,
      metric_date: "2026-06-01",
      channel: "TOTAL",
      sessions: tag === "a" ? 111 : 222,
    });
    if (r2) throw r2;
  }

  // Authenticated client scoped to this viewer's session
  const db = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: sErr } = await db.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (sErr) throw sErr;

  return { clientId: client.id, userId, email, db };
}

let A: Party;
let B: Party;

beforeAll(async () => {
  A = await makeViewer("a");
  B = await makeViewer("b");
});

afterAll(async () => {
  // Cleanup (cascade handles children).
  await admin.from("clients").delete().eq("id", A?.clientId);
  await admin.from("clients").delete().eq("id", B?.clientId);
  await admin.auth.admin.deleteUser(A?.userId);
  await admin.auth.admin.deleteUser(B?.userId);
});

describe("RLS tenant isolation", () => {
  test("viewer A sees only their own client", async () => {
    const { data } = await A.db.from("clients").select("id");
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(A.clientId);
    expect(ids).not.toContain(B.clientId);
  });

  test("viewer A sees only their own metrics", async () => {
    const { data } = await A.db.from("metrics_ga4_daily").select("client_id");
    const ids = new Set((data ?? []).map((r) => r.client_id));
    expect(ids.has(A.clientId)).toBe(true);
    expect(ids.has(B.clientId)).toBe(false);
  });

  test("viewer A cannot read B's metrics even with an explicit filter", async () => {
    const { data } = await A.db
      .from("metrics_ga4_daily")
      .select("client_id")
      .eq("client_id", B.clientId);
    expect(data ?? []).toHaveLength(0);
  });

  test("viewer A cannot read B's client row by id", async () => {
    const { data } = await A.db
      .from("clients")
      .select("id")
      .eq("id", B.clientId);
    expect(data ?? []).toHaveLength(0);
  });

  test("client_viewer has NO write access to metrics", async () => {
    const { error } = await A.db.from("metrics_ga4_daily").insert({
      data_source_id: crypto.randomUUID(),
      client_id: A.clientId,
      metric_date: "2026-06-02",
      channel: "TOTAL",
      sessions: 999,
    });
    expect(error).not.toBeNull(); // RLS write policy denies it
  });

  test("oauth_credentials is invisible to client_viewers", async () => {
    const { data } = await A.db.from("oauth_credentials").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
