import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

/** Admin portal shell. requireAdmin() bounces client_viewers to /dashboard. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <AppShell
      user={user}
      homeHref="/admin"
      nav={[
        { href: "/admin", label: "Overview" },
        { href: "/admin/clients", label: "Clients" },
      ]}
    >
      {children}
    </AppShell>
  );
}
