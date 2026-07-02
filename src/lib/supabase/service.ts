import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role Supabase client — BYPASSES RLS. Server-only.
 *
 * CLAUDE.md hard rule #3: never import this into anything reachable from a
 * client component. Used exclusively by sync workers, cron routes, OAuth
 * callbacks, and the write half of /api/refresh (after a session-based
 * membership check).
 *
 * The `server-only` import makes the build fail if this module is ever pulled
 * into a client bundle.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
