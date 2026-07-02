"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface InviteState {
  error?: string;
}

/**
 * Sets the password for a user who arrived via an invite/recovery link.
 * The session is already established by /auth/confirm, so updateUser works.
 */
export async function setPassword(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your invite link has expired. Ask an admin to resend it." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Could not set password. Please try again." };
  }

  redirect("/");
}
