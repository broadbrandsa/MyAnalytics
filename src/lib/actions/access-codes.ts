"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isValidCodeFormat, generateCode, CODE_LENGTH } from "@/lib/access/codes";
import { type ActionResult } from "@/lib/actions/result";

/** Set a specific access code for a client (admin-chosen). Must be unique. */
export async function setAccessCode(
  clientId: string,
  code: string,
): Promise<ActionResult> {
  await requireAdmin();
  const trimmed = code.trim();
  if (!isValidCodeFormat(trimmed)) {
    return { ok: false, error: `Code must be ${CODE_LENGTH} digits.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ access_code: trimmed })
    .eq("id", clientId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That code is already in use by another client." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: "Access code updated." };
}

/** Generate a unique random code for a client. Retries on the rare collision. */
export async function regenerateAccessCode(
  clientId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const { error } = await supabase
      .from("clients")
      .update({ access_code: code })
      .eq("id", clientId);
    if (!error) {
      revalidatePath(`/admin/clients/${clientId}`);
      return { ok: true, message: `New access code: ${code}` };
    }
    if (error.code !== "23505") return { ok: false, error: error.message };
    // else collision → try another code
  }
  return { ok: false, error: "Couldn't generate a free code — try again." };
}

/** Remove a client's access code (disables code entry for that client). */
export async function clearAccessCode(clientId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ access_code: null })
    .eq("id", clientId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: "Access code removed." };
}
