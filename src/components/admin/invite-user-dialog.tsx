"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inviteUser } from "@/lib/actions/users";

/**
 * Invite a client_viewer to a specific client. (Admin invites are handled from
 * the global users area; here role is fixed to client_viewer.)
 */
export function InviteUserDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await inviteUser(null, formData);
      if (res.ok) {
        toast.success(res.message ?? "Invitation sent.");
        setFieldErrors({});
        setOpen(false);
        router.refresh();
      } else {
        setFieldErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus className="size-4" />
        Invite viewer
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite viewer</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email to set a password and access this
            client&apos;s dashboard.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="role" value="client_viewer" />
          <input type="hidden" name="client_id" value={clientId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              placeholder="Olivia Rhye"
            />
            {fieldErrors.full_name && (
              <p className="text-destructive text-xs">{fieldErrors.full_name}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="olivia@acme.com"
            />
            {fieldErrors.email && (
              <p className="text-destructive text-xs">{fieldErrors.email}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
