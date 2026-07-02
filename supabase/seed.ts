/**
 * Seed script for local dev. Creates a super_admin, a demo client, a demo
 * client_viewer, and the membership linking them. Idempotent: safe to re-run.
 *
 *   npm run seed
 *
 * Reads Supabase URL + service-role key from .env.local (populate from
 * `supabase status` after `supabase start`). Uses the service-role admin API
 * (server-only, bypasses RLS) — never ship this key to the browser.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAIL = "admin@broadbrand.local";
const ADMIN_PASSWORD = "password123";
const VIEWER_EMAIL = "viewer@democlient.local";
const VIEWER_PASSWORD = "password123";
const DEMO_SLUG = "demo-client";

async function findUserByEmail(email: string) {
  // Admin listUsers is paginated; fine for a dev seed with few users.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(
  email: string,
  password: string,
  fullName: string,
  role: "super_admin" | "client_viewer",
) {
  const existing = await findUserByEmail(email);
  if (existing) {
    console.log(`  user ${email} already exists (${existing.id})`);
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw error;
  console.log(`  created user ${email} (${data.user.id})`);
  return data.user.id;
}

async function main() {
  console.log("Seeding local database…");

  const adminId = await ensureUser(
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    "Broadbrand Admin",
    "super_admin",
  );

  const viewerId = await ensureUser(
    VIEWER_EMAIL,
    VIEWER_PASSWORD,
    "Demo Client Viewer",
    "client_viewer",
  );

  // Demo client (upsert on unique slug).
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .upsert(
      {
        name: "Demo Client",
        slug: DEMO_SLUG,
        brand_color: "#4f46e5",
        timezone: "Africa/Johannesburg",
        currency: "ZAR",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (clientErr) throw clientErr;
  console.log(`  demo client ready (${client.id})`);

  // Membership: viewer -> demo client.
  const { error: memErr } = await supabase
    .from("memberships")
    .upsert(
      { client_id: client.id, user_id: viewerId },
      { onConflict: "client_id,user_id" },
    );
  if (memErr) throw memErr;
  console.log("  membership linked");

  // Empty dashboard config for the demo client.
  const { error: cfgErr } = await supabase
    .from("dashboard_configs")
    .upsert({ client_id: client.id }, { onConflict: "client_id" });
  if (cfgErr) throw cfgErr;

  console.log("\nDone. Sign in at http://localhost:3000/login");
  console.log(`  Admin:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Viewer: ${VIEWER_EMAIL} / ${VIEWER_PASSWORD}`);
  void adminId;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
