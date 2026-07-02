import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";

/**
 * Shared chrome for authenticated surfaces: brand bar + user + sign out.
 * `homeHref` differs per surface (admin → /admin, client → /dashboard).
 */
export function AppShell({
  user,
  homeHref,
  nav,
  children,
}: {
  user: CurrentUser;
  homeHref: string;
  nav?: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const roleLabel =
    user.role === "super_admin"
      ? "Super admin"
      : user.role === "admin"
        ? "Admin"
        : "Viewer";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href={homeHref} className="font-semibold">
              Broadbrand Analytics
            </Link>
            {nav && nav.length > 0 && (
              <nav className="hidden items-center gap-4 sm:flex">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{roleLabel}</Badge>
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
