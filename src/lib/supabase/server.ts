import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Server Supabase client (RSC / Server Actions / Route Handlers).
 * Uses the caller's session via cookies + RLS. NEVER use for privileged
 * cross-tenant writes — that's `service.ts`.
 *
 * Always authenticate with `supabase.auth.getUser()`, never `getSession()`
 * (see CLAUDE.md hard rule #4).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In RSC render, cookies() is read-only and throws on set — that's
          // fine, session refresh is handled centrally in proxy.ts.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; ignore.
          }
        },
      },
    },
  );
}
