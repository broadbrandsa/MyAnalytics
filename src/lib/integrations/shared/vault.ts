import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Supabase Vault helpers. CLAUDE.md hard rule #2: OAuth refresh tokens and the
 * Meta system-user token live ONLY in Vault, referenced by vault_secret_id.
 *
 * The `vault` schema isn't exposed via PostgREST, so these go through the
 * public SECURITY DEFINER wrappers (migration 20260706113100), which are
 * execute-granted to service_role only. Never log the returned secret.
 */

/** Store a new secret; returns its vault UUID (persist as oauth_credentials.vault_secret_id). */
export async function createSecret(
  secret: string,
  name: string,
  description?: string,
): Promise<string> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc("create_vault_secret", {
    secret,
    name,
    description: description ?? "",
  });
  if (error) throw new Error(`create_vault_secret failed: ${error.message}`);
  return data as string;
}

/** Read a decrypted secret by id. Service-role only; result is sensitive. */
export async function readSecret(secretId: string): Promise<string> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc("read_vault_secret", {
    secret_id: secretId,
  });
  if (error) throw new Error(`read_vault_secret failed: ${error.message}`);
  if (data == null) throw new Error("vault secret not found");
  return data as string;
}

/** Rotate an existing secret in place (Meta 60-day token refresh). */
export async function updateSecret(
  secretId: string,
  newSecret: string,
): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc.rpc("update_vault_secret", {
    secret_id: secretId,
    secret: newSecret,
  });
  if (error) throw new Error(`update_vault_secret failed: ${error.message}`);
}
