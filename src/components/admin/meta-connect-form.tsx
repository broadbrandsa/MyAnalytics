"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectMeta } from "@/lib/actions/connections";

/**
 * Admin pastes the Meta system-user token (or interim admin user token during
 * bootstrap, per doc 07). The token is validated + exchanged server-side and
 * only ever stored in Vault — it never round-trips back to the client.
 */
export function MetaConnectForm({ connected }: { connected: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await connectMeta(null, formData);
      if (res.ok) {
        toast.success(res.message ?? "Meta connected.");
        (document.getElementById("meta-token") as HTMLInputElement).value = "";
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meta-token">
          {connected ? "Replace system-user token" : "System-user token"}
        </Label>
        <Input
          id="meta-token"
          name="token"
          type="password"
          autoComplete="off"
          placeholder="EAAG…"
          required
        />
        <p className="text-muted-foreground text-xs">
          Generated in Business Manager (system user → generate token, scope
          ads_read, business_management). Stored encrypted in Vault.
        </p>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Validating…" : connected ? "Update token" : "Connect Meta"}
      </Button>
    </form>
  );
}
