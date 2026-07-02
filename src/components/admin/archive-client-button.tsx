"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setClientArchived } from "@/lib/actions/clients";

export function ArchiveClientButton({
  clientId,
  archived,
}: {
  clientId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await setClientArchived(clientId, !archived);
      if (res.ok) {
        toast.success(res.message ?? "Done.");
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
      {archived ? (
        <>
          <ArchiveRestore className="size-4" /> Restore
        </>
      ) : (
        <>
          <Archive className="size-4" /> Archive
        </>
      )}
    </Button>
  );
}
