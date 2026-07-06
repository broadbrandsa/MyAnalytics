import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createSecret,
  updateSecret,
  readSecret,
} from "@/lib/integrations/shared/vault";
import type { Provider } from "@/lib/data/credentials";

/**
 * Stores or rotates the single credential for a provider. The secret goes to
 * Vault (never a plaintext column); oauth_credentials holds only the reference.
 *
 * If a non-revoked credential already exists for the provider, its Vault secret
 * is rotated in place (avoids orphaned secrets and keeps one row per provider).
 *
 * Service-role only — callers MUST have gated on requireAdmin() / cron secret
 * beforehand.
 */
export async function upsertProviderCredential(opts: {
  provider: Provider;
  label: string;
  secret: string;
  scopes?: string[];
  expiresAt?: string | null; // ISO; Meta 60-day tokens, null for Google
}): Promise<string> {
  const svc = createServiceClient();

  const { data: existing } = await svc
    .from("oauth_credentials")
    .select("id, vault_secret_id")
    .eq("provider", opts.provider)
    .neq("status", "revoked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (existing) {
    // Rotate the secret in place, then verify it actually took. Vault's
    // update_secret is a silent no-op on a missing id (e.g. a seeded
    // placeholder), so a read-back confirms; if it didn't stick, mint a fresh
    // secret and repoint the row to it.
    let vaultSecretId = existing.vault_secret_id;
    let rotated = false;
    try {
      await updateSecret(vaultSecretId, opts.secret);
      rotated = (await readSecret(vaultSecretId)) === opts.secret;
    } catch {
      rotated = false;
    }
    if (!rotated) {
      vaultSecretId = await createSecret(
        opts.secret,
        `${opts.provider}-credential`,
        opts.label,
      );
    }
    const { error } = await svc
      .from("oauth_credentials")
      .update({
        label: opts.label,
        vault_secret_id: vaultSecretId,
        scopes: opts.scopes ?? [],
        status: "active",
        expires_at: opts.expiresAt ?? null,
        last_refreshed_at: nowIso,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const vaultSecretId = await createSecret(
    opts.secret,
    `${opts.provider}-credential`,
    opts.label,
  );

  const { data, error } = await svc
    .from("oauth_credentials")
    .insert({
      provider: opts.provider,
      label: opts.label,
      vault_secret_id: vaultSecretId,
      scopes: opts.scopes ?? [],
      status: "active",
      expires_at: opts.expiresAt ?? null,
      last_refreshed_at: nowIso,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Mark a provider credential as needing re-auth (invalid_grant / expired). */
export async function markCredentialNeedsReauth(
  credentialId: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("oauth_credentials")
    .update({ status: "needs_reauth" })
    .eq("id", credentialId);
}
