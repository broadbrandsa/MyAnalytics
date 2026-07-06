"use client";

import { useActionState } from "react";
import Link from "next/link";
import { enterCode, type AccessState } from "@/lib/actions/access";
import { CODE_LENGTH } from "@/lib/access/codes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initial: AccessState = {};

export function CodeEntry() {
  const [state, formAction, pending] = useActionState(enterCode, initial);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Broadbrand Analytics</CardTitle>
            <CardDescription>
              Enter your {CODE_LENGTH}-digit access code to view your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="flex flex-col gap-4">
              <Input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={`\\d{${CODE_LENGTH}}`}
                maxLength={CODE_LENGTH}
                required
                autoFocus
                placeholder={"•".repeat(CODE_LENGTH)}
                aria-label="Access code"
                className="text-center text-2xl tracking-[0.5em]"
              />
              {state.error && (
                <p className="text-destructive text-center text-sm" role="alert">
                  {state.error}
                </p>
              )}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Checking…" : "View dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-center text-xs">
          Broadbrand staff?{" "}
          <Link href="/login" className="underline">
            Sign in here
          </Link>
        </p>
      </div>
    </main>
  );
}
