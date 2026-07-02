import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import type { AppRole } from "@/lib/auth";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

/** List client orgs. Admins see all via RLS; archived optional. */
export async function listClients(
  includeArchived = false,
): Promise<ClientRow[]> {
  const supabase = await createClient();
  let query = supabase.from("clients").select("*").order("name");
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Fetch a single client org (RLS-scoped). */
export async function getClient(clientId: string): Promise<ClientRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  return data ?? null;
}

export interface ClientMember {
  userId: string;
  fullName: string | null;
  role: AppRole;
  email: string | null;
  active: boolean; // false when banned/deactivated
}

/**
 * Members (client_viewers) of a client, with email + active status.
 * Emails/ban status live in auth.users, so we read those via the service-role
 * admin API. Admin-only — guarded by requireAdmin().
 */
export async function getClientMembers(
  clientId: string,
): Promise<ClientMember[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("client_id", clientId);

  const userIds = (memberships ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, role")
    .in("user_id", userIds);

  // Auth details (email, banned_until) via service role.
  const svc = createServiceClient();
  const { data: authList } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const authById = new Map(authList.users.map((u) => [u.id, u]));

  return userIds.map((id) => {
    const p = (profiles ?? []).find((x) => x.user_id === id);
    const au = authById.get(id);
    const bannedUntil = (au as { banned_until?: string } | undefined)
      ?.banned_until;
    const active = !bannedUntil || new Date(bannedUntil) <= new Date();
    return {
      userId: id,
      fullName: p?.full_name ?? null,
      role: (p?.role as AppRole) ?? "client_viewer",
      email: au?.email ?? null,
      active,
    };
  });
}
