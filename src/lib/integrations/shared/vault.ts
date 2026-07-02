import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Supabase Vault helpers. CLAUDE.md hard rule #2: OAuth refresh tokens and the
 * Meta system-user token live ONLY in Vault, referenced by vault_secret_id.
 * These run with the service-role client and must never be reachable from the
 * browser. Never log the returned secret.
 *
 * Uses the SECURITY DEFINER RPCs Supabase exposes for Vault. If your project
 * predates `vault.create_secret` as an RPC, call it via a `.rpc()` wrapper or a
 * small SQL function in the `private` schema.
 */

/** Store a new secret; returns its vault UUID (persist as oauth_credentials.vault_secret_id). */
export async function createSecret(
  secret: string,
  name: string,
  description?: string,
): Promise<string> {
  const svc = createServiceClient();
  const { data, error } = await svc.schema("vault").rpc("create_secret", {
    new_secret: secret,
    new_name: name,
    new_description: description ?? "",
  });
  if (error) throw new Error(`vault.create_secret failed: ${error.message}`);
  return data as string;
}

/** Read a decrypted secret by id. Service-role only; result is sensitive. */
export async function readSecret(secretId: string): Promise<string> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .schema("vault")
    .from("decrypted_secrets")
    .select("decrypted_secret")
    .eq("id", secretId)
    .single();
  if (error) throw new Error(`vault read failed: ${error.message}`);
  return (data as { decrypted_secret: string }).decrypted_secret;
}

/** Rotate an existing secret in place (Meta 60-day token refresh). */
export async function updateSecret(
  secretId: string,
  newSecret: string,
): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc.schema("vault").rpc("update_secret", {
    secret_id: secretId,
    new_secret: newSecret,
  });
  if (error) throw new Error(`vault.update_secret failed: ${error.message}`);
}
