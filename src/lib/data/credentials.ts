import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

export type CredentialRow =
  Database["public"]["Tables"]["oauth_credentials"]["Row"];
export type Provider = "google" | "meta";

/**
 * oauth_credentials is admin-only via RLS (cred_admin_only). All reads here go
 * through the admin session; vault_secret_id is a reference only — the secret
 * itself is never selected here and never reaches the browser.
 */

export async function listCredentials(): Promise<CredentialRow[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oauth_credentials")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** The single active credential for a provider (newest wins). */
export async function getCredentialByProvider(
  provider: Provider,
): Promise<CredentialRow | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("oauth_credentials")
    .select("*")
    .eq("provider", provider)
    .neq("status", "revoked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
