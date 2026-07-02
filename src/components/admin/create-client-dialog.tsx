"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClientForm } from "@/components/admin/client-form";
import { createClientOrg } from "@/lib/actions/clients";

export function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        New client
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create client</DialogTitle>
          <DialogDescription>
            Add a new client organization. You can assign data sources and invite
            users afterwards.
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          action={createClientOrg}
          submitLabel="Create client"
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
