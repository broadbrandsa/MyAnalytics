"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, { type: "success" | "error"; text: string }> = {
  connected: { type: "success", text: "Google connected." },
  denied: { type: "error", text: "Google authorization was cancelled." },
  invalid_state: { type: "error", text: "Google sign-in expired. Try again." },
  error: { type: "error", text: "Could not connect Google. Try again." },
};

/** Surfaces the Google OAuth callback result (?google=…) as a toast, once. */
export function ConnectionToast() {
  const params = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    const status = params.get("google");
    if (!status) return;
    shown.current = true;
    const msg = MESSAGES[status];
    if (msg) toast[msg.type](msg.text);
    router.replace("/admin/connections");
  }, [params, router]);

  return null;
}
