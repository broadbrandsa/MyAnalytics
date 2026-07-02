import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — used in `"use client"` components.
 * Anon key + user session only; all reads are RLS-scoped.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
