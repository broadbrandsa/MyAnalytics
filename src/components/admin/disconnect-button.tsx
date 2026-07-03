"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectProvider } from "@/lib/actions/connections";
import type { Provider } from "@/lib/data/credentials";

export function DisconnectButton({ provider }: { provider: Provider }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await disconnectProvider(provider);
      if (res.ok) {
        toast.success(res.message ?? "Disconnected.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      Disconnect
    </Button>
  );
}
