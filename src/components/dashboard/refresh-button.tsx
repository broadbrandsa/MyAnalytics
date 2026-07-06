"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Client Refresh button. POSTs /api/refresh (authorized by the access cookie,
 * or clientId for admin preview), then polls /api/refresh/status until the sync
 * finishes and re-fetches the page. Rate-limited server-side (10 min).
 */
export function RefreshButton({ clientId }: { clientId?: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function poll(deadlineMs: number): Promise<void> {
    const q = clientId ? `?clientId=${clientId}` : "";
    while (Date.now() < deadlineMs) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const res = await fetch(`/api/refresh/status${q}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const s = (await res.json()) as { running: boolean };
          if (!s.running) return;
        }
      } catch {
        // keep polling until deadline
      }
    }
  }

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientId ? { clientId } : {}),
      });

      if (res.status === 429) {
        const { retryAfter } = (await res.json()) as { retryAfter: number };
        const mins = Math.ceil((retryAfter ?? 60) / 60);
        toast.info(`Already up to date — try again in ${mins} min.`);
        return;
      }
      if (!res.ok) {
        toast.error("Couldn't refresh right now.");
        return;
      }

      toast.info("Refreshing your data…");
      await poll(Date.now() + 60_000);
      router.refresh();
      toast.success("Dashboard updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={busy}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
      {busy ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
