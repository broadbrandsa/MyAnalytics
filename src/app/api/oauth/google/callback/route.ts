import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/integrations/shared/google-auth";
import { upsertProviderCredential } from "@/lib/integrations/shared/credentials-store";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REDIRECT_URI = `${SITE_URL}/api/oauth/google/callback`;

function backToConnections(status: string) {
  return NextResponse.redirect(
    `${SITE_URL}/admin/connections?google=${status}`,
  );
}

/**
 * Google OAuth callback. Verifies CSRF state, exchanges the code for a refresh
 * token, stores it in Vault, and upserts the single Google agency credential.
 * The refresh token never touches a response body or log.
 */
export async function GET(request: NextRequest) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("g_oauth_state")?.value;
  cookieStore.delete("g_oauth_state");

  if (oauthError) return backToConnections("denied");
  if (!code || !state || !expectedState || state !== expectedState) {
    return backToConnections("invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, REDIRECT_URI);
    await upsertProviderCredential({
      provider: "google",
      label: "Broadbrand agency Google",
      secret: tokens.refreshToken,
      scopes: tokens.scopes,
      expiresAt: null, // Google refresh tokens don't expire (kept alive by cron)
    });
    return backToConnections("connected");
  } catch (err) {
    // Log the failure WITHOUT the token/code.
    console.error(
      "Google OAuth callback failed:",
      err instanceof Error ? err.message : "unknown error",
    );
    return backToConnections("error");
  }
}
