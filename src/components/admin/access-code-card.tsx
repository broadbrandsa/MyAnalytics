"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Copy, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  regenerateAccessCode,
  setAccessCode,
  clearAccessCode,
} from "@/lib/actions/access-codes";
import { CODE_LENGTH } from "@/lib/access/codes";
import type { ActionResult } from "@/lib/actions/result";

export function AccessCodeCard({
  clientId,
  code,
}: {
  clientId: string;
  code: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState("");
  const router = useRouter();

  function run(fn: () => Promise<ActionResult>, onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        onOk?.();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" />
          Access code
        </CardTitle>
        <CardDescription>
          Clients enter this {CODE_LENGTH}-digit code to open their dashboard — no
          login required. Share it with anyone who should have access.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-muted rounded-md px-4 py-2 font-mono text-2xl tracking-[0.4em] tabular-nums">
            {code ?? "— — — —"}
          </div>
          {code && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(code);
                toast.success("Code copied.");
              }}
              aria-label="Copy code"
            >
              <Copy className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => regenerateAccessCode(clientId))}
          >
            <RefreshCw className="size-4" />
            {code ? "Regenerate" : "Generate code"}
          </Button>
          {code && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => clearAccessCode(clientId))}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          )}
        </div>

        <div className="flex items-end gap-2 border-t pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-code" className="text-xs">
              Set a specific code
            </Label>
            <Input
              id="custom-code"
              inputMode="numeric"
              maxLength={CODE_LENGTH}
              value={custom}
              onChange={(e) =>
                setCustom(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
              }
              placeholder={"0".repeat(CODE_LENGTH)}
              className="w-32 font-mono tracking-widest"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || custom.length !== CODE_LENGTH}
            onClick={() =>
              run(
                () => setAccessCode(clientId, custom),
                () => setCustom(""),
              )
            }
          >
            Set code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
