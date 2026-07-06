import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Chrome for the code-gated client dashboard. No accounts/roles — just the
 * brand bar and an "Exit" that clears the access cookie.
 */
export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <span className="font-semibold">Broadbrand Analytics</span>
          <form action="/access/exit" method="post">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-4" />
              Exit
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
