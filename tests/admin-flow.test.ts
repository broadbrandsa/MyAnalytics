/**
 * Phase 1 — admin portal flow at the DB level. Verifies the exact operations
 * the Server Actions perform:
 *   - an admin session can create a client (RLS `client_admin_write` via is_admin)
 *   - inviting a user creates a profile with the right role (doc-03 trigger)
 *   - membership links a viewer to a client
 *   - the viewer sees only that client (RLS), and cannot create clients
 *
 * Runs against local Supabase. Requires .env.local.
 */
import { beforeAll, afterAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN = Date.now().toString(36);
const PASSWORD = "password123!";
const ADMIN_EMAIL = `admin-${RUN}@test.local`;
const VIEWER_EMAIL = `viewer-${RUN}@test.local`;
const OTHER_SLUG = `other-${RUN}`;

let adminDb: SupabaseClient; // authenticated admin session
let viewerId: string;
let adminUserId: string;
let createdClientId: string;
let otherClientId: string;

async function signIn(email: string): Promise<SupabaseClient> {
  const db = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  return db;
}

beforeAll(async () => {
  // An admin user (super_admin) + an "other" client they don't create in-test.
  const { data: a } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Test Admin", role: "super_admin" },
  });
  adminUserId = a.user!.id;

  const { data: other } = await admin
    .from("clients")
    .insert({ name: `Other ${RUN}`, slug: OTHER_SLUG })
    .select("id")
    .single();
  otherClientId = other!.id;

  adminDb = await signIn(ADMIN_EMAIL);
});

afterAll(async () => {
  if (createdClientId) await admin.from("clients").delete().eq("id", createdClientId);
  if (otherClientId) await admin.from("clients").delete().eq("id", otherClientId);
  if (viewerId) await admin.auth.admin.deleteUser(viewerId);
  if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
});

describe("Phase 1 admin flow", () => {
  test("admin session can create a client (RLS admin write)", async () => {
    const { data, error } = await adminDb
      .from("clients")
      .insert({ name: `Created ${RUN}`, slug: `created-${RUN}`, currency: "ZAR" })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    createdClientId = data!.id;
  });

  test("inviting a viewer creates a profile with role via the trigger", async () => {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      VIEWER_EMAIL,
      { data: { full_name: "Test Viewer", role: "client_viewer" } },
    );
    // In some local setups invite may require SMTP; fall back to createUser.
    if (error) {
      const { data: created } = await admin.auth.admin.createUser({
        email: VIEWER_EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Test Viewer", role: "client_viewer" },
      });
      viewerId = created.user!.id;
    } else {
      viewerId = data.user.id;
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role, full_name")
      .eq("user_id", viewerId)
      .single();
    expect(profile?.role).toBe("client_viewer");
    expect(profile?.full_name).toBe("Test Viewer");
  });

  test("admin can link the viewer to the created client (membership)", async () => {
    const { error } = await adminDb
      .from("memberships")
      .insert({ client_id: createdClientId, user_id: viewerId });
    expect(error).toBeNull();
  });

  test("viewer sees only their linked client via RLS", async () => {
    // Ensure the viewer can sign in: set a password and confirm the email
    // (invited users are unconfirmed until they accept via the email link).
    await admin.auth.admin.updateUserById(viewerId, {
      password: PASSWORD,
      email_confirm: true,
    });
    const viewerDb = await signIn(VIEWER_EMAIL);

    const { data } = await viewerDb.from("clients").select("id");
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(createdClientId);
    expect(ids).not.toContain(otherClientId);
  });

  test("viewer cannot create a client (RLS denies write)", async () => {
    const viewerDb = await signIn(VIEWER_EMAIL);
    const { error } = await viewerDb
      .from("clients")
      .insert({ name: "Nope", slug: `nope-${RUN}` });
    expect(error).not.toBeNull();
  });
});
