import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session and enforces coarse route protection.
 * Invoked from `proxy.ts` (Next 16's rename of middleware).
 *
 * Cookie handling follows the official @supabase/ssr pattern: cookies must be
 * written to BOTH the request (so downstream reads see them) AND the response
 * (so the browser persists them). See CLAUDE.md hard rule #4.
 *
 * Fine-grained role checks (admin vs client_viewer) live in the route-group
 * layouts via getUser() + profiles.role — proxy only gates authenticated vs not.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession()) — validates the token server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" || // client code-entry landing
    pathname.startsWith("/dashboard") || // code-gated in the (client) layout
    pathname.startsWith("/access") || // code entry/exit
    pathname.startsWith("/api/refresh") || // authorized by access cookie or session
    pathname.startsWith("/login") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/oauth") ||
    // Cron/sync workers self-authenticate via CRON_SECRET (hard rule #8);
    // they must not be bounced to /login by the session guard.
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/sync") ||
    pathname.startsWith("/api/backfill");

  // Unauthenticated users hitting a protected route.
  if (!user && !isPublic) {
    // API routes get a clean 401 (fetch shouldn't follow a redirect to HTML);
    // page routes get bounced to login.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated admins on the login page → the admin portal.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Must return the (possibly cookie-mutated) response object as-is.
  return supabaseResponse;
}
