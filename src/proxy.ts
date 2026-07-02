import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/**
 * Next.js 16 proxy (renamed from middleware). Runs on the Node runtime.
 * Refreshes the Supabase session on every request and applies coarse
 * authenticated-vs-not route protection. Role gating happens in layouts.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (build assets)
     * - favicon and common static file extensions
     * Cron/sync/refresh API routes do their own auth; they are still fine to
     * pass through session refresh (they simply won't have a user cookie).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
