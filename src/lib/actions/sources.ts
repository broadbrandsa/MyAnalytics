"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCredentialByProvider } from "@/lib/data/credentials";
import { SOURCE_META } from "@/lib/sources-shared";
import { SOURCES, type Source } from "@/lib/constants";
import {
  getGoogleAccessToken,
  InvalidGrantError,
} from "@/lib/integrations/shared/google-auth";
import { readSecret } from "@/lib/integrations/shared/vault";
import { markCredentialNeedsReauth } from "@/lib/integrations/shared/credentials-store";
import { listGa4Properties } from "@/lib/integrations/ga4/client";
import { listGscSites } from "@/lib/integrations/gsc/client";
import { listGadsAccounts } from "@/lib/integrations/gads/client";
import { listAdAccounts } from "@/lib/integrations/meta/client";
import { callBackfill } from "@/lib/sync/dispatch";
import { type ActionResult } from "@/lib/actions/result";

export interface SourceOption {
  externalId: string;
  label: string;
  sublabel?: string;
  currency?: string | null;
  timezone?: string | null;
  loginCustomerId?: string | null; // Google Ads: manager to query under
}

export type SourceOptionsResult =
  | { ok: true; options: SourceOption[] }
  | { ok: false; error: string };

/**
 * Fetch the accounts/properties available for a source type from the platform
 * listing endpoints, using the shared agency/Meta credential. Admin-only.
 * Maps invalid_grant → credential needs_reauth (doc 04–07).
 */
export async function fetchAvailableSources(
  source: Source,
): Promise<SourceOptionsResult> {
  await requireAdmin();
  if (!SOURCES.includes(source)) return { ok: false, error: "Unknown source." };

  const provider = SOURCE_META[source].provider;
  const cred = await getCredentialByProvider(provider);
  if (!cred) {
    return {
      ok: false,
      error: `Connect ${provider === "google" ? "Google" : "Meta"} first.`,
    };
  }
  if (cred.status === "needs_reauth") {
    return { ok: false, error: "Credential needs re-authorization." };
  }

  try {
    let options: SourceOption[] = [];

    if (provider === "google") {
      const token = await getGoogleAccessToken(cred.vault_secret_id);
      if (source === "ga4") {
        options = (await listGa4Properties(token)).map((p) => ({
          externalId: p.property,
          label: p.displayName,
          sublabel: p.accountName,
        }));
      } else if (source === "gsc") {
        options = (await listGscSites(token)).map((s) => ({
          externalId: s.siteUrl,
          label: s.siteUrl,
          sublabel: s.permissionLevel,
        }));
      } else if (source === "google_ads") {
        options = (await listGadsAccounts(token)).map((a) => ({
          externalId: a.id,
          label: a.descriptiveName,
          sublabel: a.currencyCode ?? undefined,
          currency: a.currencyCode,
          timezone: a.timeZone,
          loginCustomerId: a.loginCustomerId,
        }));
      }
    } else {
      const token = await readSecret(cred.vault_secret_id);
      options = (await listAdAccounts(token)).map((a) => ({
        externalId: a.id,
        label: a.name ?? a.id,
        sublabel: a.currency,
        currency: a.currency ?? null,
        timezone: a.timezone_name ?? null,
      }));
    }

    return { ok: true, options };
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await markCredentialNeedsReauth(cred.id);
      return { ok: false, error: "Google authorization expired — reconnect." };
    }
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to list accounts.",
    };
  }
}

interface AssignInput {
  clientId: string;
  source: Source;
  externalId: string;
  displayName: string;
  currency?: string | null;
  timezone?: string | null;
  loginCustomerId?: string | null;
}

/** Assign a platform account to a client (creates a data_sources row). */
export async function assignSource(input: AssignInput): Promise<ActionResult> {
  await requireAdmin();
  if (!SOURCES.includes(input.source)) {
    return { ok: false, error: "Unknown source." };
  }
  if (!input.externalId || !input.displayName) {
    return { ok: false, error: "Missing account selection." };
  }

  const provider = SOURCE_META[input.source].provider;
  const cred = await getCredentialByProvider(provider);
  if (!cred) return { ok: false, error: "Connect the provider first." };

  // Store currency/timezone in config for Ads + Meta (money rule: currency per source).
  const config: Record<string, string> = {};
  if (input.currency) config.currency = input.currency;
  if (input.timezone) config.timezone = input.timezone;
  // Google Ads: remember which manager (MCC or the account itself) to query under.
  if (input.source === "google_ads" && input.loginCustomerId) {
    config.login_customer_id = input.loginCustomerId;
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("data_sources")
    .insert({
      client_id: input.clientId,
      credential_id: cred.id,
      source: input.source,
      external_id: input.externalId,
      display_name: input.displayName,
      config,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That account is already assigned." };
    }
    return { ok: false, error: error.message };
  }

  // Kick off the 13-month backfill chain after responding (doc 02).
  const newId = inserted.id;
  after(() => callBackfill(newId, 0));

  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true, message: "Source assigned. Backfill started." };
}

/** Remove a source assignment (cascades its cached metrics). */
export async function removeSource(
  dataSourceId: string,
  clientId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("data_sources")
    .delete()
    .eq("id", dataSourceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: "Source removed." };
}
