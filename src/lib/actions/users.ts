"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { inviteSchema, APP_ROLES } from "@/lib/validation";
import { type ActionResult, fieldErrorsFromZod } from "@/lib/actions/result";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
// Effectively-permanent ban used to deactivate an account (~100 years).
const DEACTIVATE_DURATION = "876000h";

/**
 * Invite a user by email. Uses the service-role admin API (requireAdmin gates
 * it first). The doc-03 trigger creates the profile from user_metadata
 * (full_name, role). For client_viewers we also insert the membership row.
 */
export async function inviteUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }
  const { email, full_name, role, client_id } = parsed.data;

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    redirectTo: `${SITE_URL}/auth/confirm`,
  });

  if (error) {
    const already =
      error.message.toLowerCase().includes("already") ||
      error.status === 422;
    return {
      ok: false,
      error: already
        ? "A user with that email already exists."
        : error.message,
      fieldErrors: already ? { email: "Email already in use." } : undefined,
    };
  }

  // Link client_viewers to their client org.
  if (role === "client_viewer" && client_id) {
    const { error: memErr } = await svc
      .from("memberships")
      .upsert(
        { client_id, user_id: data.user.id },
        { onConflict: "client_id,user_id" },
      );
    if (memErr) return { ok: false, error: memErr.message };
    revalidatePath(`/admin/clients/${client_id}`);
  }

  revalidatePath("/admin/users");
  return { ok: true, message: `Invitation sent to ${email}.` };
}

/** Deactivate (ban) or reactivate a user. Service-role admin API. */
export async function setUserActive(
  userId: string,
  active: boolean,
  clientId?: string,
): Promise<ActionResult> {
  await requireAdmin();
  const svc = createServiceClient();
  const { error } = await svc.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : DEACTIVATE_DURATION,
  });
  if (error) return { ok: false, error: error.message };

  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/users");
  return {
    ok: true,
    message: active ? "User reactivated." : "User deactivated.",
  };
}

/** Change a user's role. profiles admin-update RLS authorizes via the session. */
export async function changeUserRole(
  userId: string,
  role: (typeof APP_ROLES)[number],
  clientId?: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!APP_ROLES.includes(role)) {
    return { ok: false, error: "Invalid role." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/users");
  return { ok: true, message: "Role updated." };
}

/** Remove a viewer's membership in a client (does not delete the account). */
export async function removeMembership(
  userId: string,
  clientId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: "Member removed." };
}
