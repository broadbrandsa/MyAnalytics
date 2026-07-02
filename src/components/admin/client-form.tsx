"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/actions/result";
import type { ClientRow } from "@/lib/data/clients";

type FormAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

function Field({
  id,
  label,
  error,
  children,
  hint,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-muted-foreground text-xs">{hint}</p>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export function ClientForm({
  action,
  defaults,
  submitLabel = "Save",
  onSuccess,
}: {
  action: FormAction;
  defaults?: Partial<ClientRow>;
  submitLabel?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      onSuccess?.();
      if (state.redirectTo) router.push(state.redirectTo);
      else router.refresh();
    } else if (state && !state.ok && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, onSuccess, router]);

  const fe = (state && !state.ok && state.fieldErrors) || {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id="name" label="Client name" error={fe.name}>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
          placeholder="Acme Inc."
        />
      </Field>

      <Field
        id="slug"
        label="Slug"
        error={fe.slug}
        hint="URL identifier. Leave blank to generate from the name."
      >
        <Input
          id="slug"
          name="slug"
          defaultValue={defaults?.slug ?? ""}
          placeholder="acme-inc"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="brand_color" label="Brand color" error={fe.brand_color}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Brand color picker"
              defaultValue={defaults?.brand_color ?? "#4f46e5"}
              onChange={(e) => {
                const text = document.getElementById(
                  "brand_color",
                ) as HTMLInputElement | null;
                if (text) text.value = e.target.value;
              }}
              className="border-input h-9 w-10 rounded-md border"
            />
            <Input
              id="brand_color"
              name="brand_color"
              defaultValue={defaults?.brand_color ?? "#4f46e5"}
              placeholder="#4f46e5"
              className="flex-1"
            />
          </div>
        </Field>

        <Field id="currency" label="Currency" error={fe.currency}>
          <Input
            id="currency"
            name="currency"
            defaultValue={defaults?.currency ?? "ZAR"}
            placeholder="ZAR"
            maxLength={3}
            className="uppercase"
          />
        </Field>
      </div>

      <Field id="timezone" label="Timezone" error={fe.timezone}>
        <Input
          id="timezone"
          name="timezone"
          defaultValue={defaults?.timezone ?? "Africa/Johannesburg"}
          placeholder="Africa/Johannesburg"
        />
      </Field>

      <Field
        id="logo_url"
        label="Logo URL"
        error={fe.logo_url}
        hint="Optional. Shown on the client's dashboard."
      >
        <Input
          id="logo_url"
          name="logo_url"
          type="url"
          defaultValue={defaults?.logo_url ?? ""}
          placeholder="https://…/logo.png"
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
