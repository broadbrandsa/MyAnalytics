"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { clientSchema, slugify } from "@/lib/validation";
import { type ActionResult, fieldErrorsFromZod } from "@/lib/actions/result";

/**
 * Client-org CRUD. All actions require an admin. Writes go through the caller's
 * session client — RLS `client_admin_write` (is_admin()) authorizes them, so we
 * don't need the service-role key here.
 */

export async function createClientOrg(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const input = parsed.data;
  const slug = input.slug && input.slug !== "" ? input.slug : slugify(input.name);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: input.name,
      slug,
      brand_color: input.brand_color || null,
      logo_url: input.logo_url || null,
      timezone: input.timezone,
      currency: input.currency,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That slug is already taken.",
        fieldErrors: { slug: "Already in use — choose another." },
      };
    }
    return { ok: false, error: error.message };
  }

  // A dashboard_configs row per client (empty default layout).
  await supabase.from("dashboard_configs").upsert({ client_id: data.id });

  revalidatePath("/admin/clients");
  return { ok: true, redirectTo: `/admin/clients/${data.id}` };
}

export async function updateClientOrg(
  clientId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name: input.name,
      ...(input.slug && input.slug !== "" ? { slug: input.slug } : {}),
      brand_color: input.brand_color || null,
      logo_url: input.logo_url || null,
      timezone: input.timezone,
      currency: input.currency,
    })
    .eq("id", clientId);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That slug is already taken.",
        fieldErrors: { slug: "Already in use — choose another." },
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  return { ok: true, message: "Client updated." };
}

export async function setClientArchived(
  clientId: string,
  archived: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ is_archived: archived })
    .eq("id", clientId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: archived ? "Client archived." : "Client restored." };
}
