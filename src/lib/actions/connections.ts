"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  validateMetaToken,
  exchangeForLongLivedToken,
  MetaApiError,
} from "@/lib/integrations/meta/client";
import { upsertProviderCredential } from "@/lib/integrations/shared/credentials-store";
import { type ActionResult } from "@/lib/actions/result";
import type { Provider } from "@/lib/data/credentials";

const tokenSchema = z.object({
  token: z.string().trim().min(20, "That doesn't look like a valid token."),
});

/**
 * Store the Meta system-user token (or interim admin user token during
 * bootstrap, per doc 07). Validates via /me, then exchanges for a fresh 60-day
 * token so we capture an accurate expiry. The token only ever lands in Vault.
 */
export async function connectMeta(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = tokenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid token." };
  }
  const pasted = parsed.data.token;

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return {
      ok: false,
      error: "META_APP_ID / META_APP_SECRET are not configured on the server.",
    };
  }

  try {
    // 1) Validate the pasted token.
    await validateMetaToken(pasted);

    // 2) Normalize to a fresh 60-day token + accurate expiry.
    const { accessToken, expiresIn } = await exchangeForLongLivedToken(pasted);
    const expiresAt =
      expiresIn != null
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

    await upsertProviderCredential({
      provider: "meta",
      label: "BB Business Manager system user",
      secret: accessToken,
      scopes: ["ads_read", "business_management"],
      expiresAt,
    });

    revalidatePath("/admin/connections");
    return { ok: true, message: "Meta connected." };
  } catch (err) {
    const msg =
      err instanceof MetaApiError
        ? err.message
        : "Could not validate the token. Check it and try again.";
    return { ok: false, error: msg };
  }
}

/** Revoke a provider credential (keeps the row for audit; blocks further use). */
export async function disconnectProvider(
  provider: Provider,
): Promise<ActionResult> {
  await requireAdmin();
  const svc = createServiceClient();
  const { error } = await svc
    .from("oauth_credentials")
    .update({ status: "revoked" })
    .eq("provider", provider)
    .neq("status", "revoked");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/connections");
  return { ok: true, message: `${provider === "google" ? "Google" : "Meta"} disconnected.` };
}
