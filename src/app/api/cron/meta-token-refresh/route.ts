import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { readSecret, updateSecret } from "@/lib/integrations/shared/vault";
import {
  exchangeForLongLivedToken,
  validateMetaToken,
} from "@/lib/integrations/meta/client";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly Meta token refresh (vercel.json: Mondays 06:00 UTC). Re-exchanges the
 * system-user token for a fresh 60-day one, rotates the Vault secret, and
 * updates expires_at. Zero-downtime: exchange → verify via /me → treat as
 * current. On failure, marks the credential needs_reauth (alerting in Phase 6).
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data: cred } = await svc
    .from("oauth_credentials")
    .select("id, vault_secret_id, status")
    .eq("provider", "meta")
    .neq("status", "revoked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cred) {
    return NextResponse.json({ ok: true, skipped: "no meta credential" });
  }

  try {
    const current = await readSecret(cred.vault_secret_id);
    const { accessToken, expiresIn } = await exchangeForLongLivedToken(current);

    // Verify the new token before committing to it.
    await validateMetaToken(accessToken);

    await updateSecret(cred.vault_secret_id, accessToken);
    const expiresAt =
      expiresIn != null
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;
    await svc
      .from("oauth_credentials")
      .update({
        status: "active",
        expires_at: expiresAt,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq("id", cred.id);

    return NextResponse.json({ ok: true, refreshed: true, expiresAt });
  } catch (err) {
    console.error(
      "Meta token refresh failed:",
      err instanceof Error ? err.message : "unknown error",
    );
    await svc
      .from("oauth_credentials")
      .update({ status: "needs_reauth" })
      .eq("id", cred.id);
    await sendAlert(
      "Meta system-user token refresh failed — reconnect required in Connections.",
    );
    return NextResponse.json(
      { ok: false, error: "refresh_failed" },
      { status: 500 },
    );
  }
}

// Allow GET for Vercel Cron (it issues GET by default) as well as manual POST.
export const GET = POST;
