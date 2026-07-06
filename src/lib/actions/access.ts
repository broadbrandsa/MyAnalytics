"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { setAccessCookie } from "@/lib/access/cookie";
import { isValidCodeFormat, CODE_LENGTH } from "@/lib/access/codes";
import {
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
} from "@/lib/access/rate-limit";

export interface AccessState {
  error?: string;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Validates a client access code and, on success, sets the signed access cookie
 * and sends the visitor to their dashboard. Rate-limited per IP to blunt
 * brute-force guessing of short codes.
 */
export async function enterCode(
  _prev: AccessState | null,
  formData: FormData,
): Promise<AccessState> {
  const code = String(formData.get("code") ?? "").trim();
  const ip = await clientIp();

  const rl = await checkRateLimit(ip);
  if (rl.limited) {
    const mins = Math.ceil(rl.retryAfter / 60);
    return { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  if (!isValidCodeFormat(code)) {
    await recordFailedAttempt(ip);
    return { error: `Enter your ${CODE_LENGTH}-digit code.` };
  }

  const svc = createServiceClient();
  const { data: client } = await svc
    .from("clients")
    .select("id, is_archived")
    .eq("access_code", code)
    .maybeSingle();

  if (!client || client.is_archived) {
    await recordFailedAttempt(ip);
    return { error: "That code isn't valid. Check it and try again." };
  }

  await clearAttempts(ip);
  await setAccessCookie(client.id);
  redirect("/dashboard");
}
