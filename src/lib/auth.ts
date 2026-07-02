import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "super_admin" | "admin" | "client_viewer";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: AppRole;
  fullName: string | null;
}

/**
 * Loads the authenticated user + their profile role. Always uses getUser()
 * (validated server-side), never getSession(). Redirects to /login if there is
 * no valid session. Use in every protected layout/page.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as AppRole) ?? "client_viewer",
    fullName: profile?.full_name ?? null,
  };
}

export function isAdmin(role: AppRole): boolean {
  return role === "admin" || role === "super_admin";
}

/** Require an admin/super_admin; client_viewers are bounced to their dashboard. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/dashboard");
  return user;
}
