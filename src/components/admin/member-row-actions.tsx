"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  setUserActive,
  removeMembership,
  changeUserRole,
} from "@/lib/actions/users";
import type { ActionResult } from "@/lib/actions/result";
import type { ClientMember } from "@/lib/data/clients";

export function MemberRowActions({
  member,
  clientId,
}: {
  member: ClientMember;
  clientId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" disabled={pending} />}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Member actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {member.active ? (
          <DropdownMenuItem
            onClick={() =>
              run(() => setUserActive(member.userId, false, clientId))
            }
          >
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              run(() => setUserActive(member.userId, true, clientId))
            }
          >
            Reactivate
          </DropdownMenuItem>
        )}
        {member.role === "client_viewer" ? (
          <DropdownMenuItem
            onClick={() => run(() => changeUserRole(member.userId, "admin"))}
          >
            Promote to admin
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              run(() => changeUserRole(member.userId, "client_viewer", clientId))
            }
          >
            Set as viewer
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => run(() => removeMembership(member.userId, clientId))}
        >
          Remove from client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
