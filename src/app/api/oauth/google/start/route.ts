import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { buildGoogleAuthUrl } from "@/lib/integrations/shared/google-auth";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REDIRECT_URI = `${SITE_URL}/api/oauth/google/callback`;

/**
 * Kicks off the one agency-level Google OAuth grant (GA4 + GSC + Ads scopes).
 * Admin-only. Sets a short-lived CSRF `state` cookie verified in the callback.
 */
export async function GET() {
  await requireAdmin();

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });

  return NextResponse.redirect(buildGoogleAuthUrl(REDIRECT_URI, state));
}
