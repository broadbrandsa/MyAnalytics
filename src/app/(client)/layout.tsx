import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

/**
 * Client dashboard shell. Any authenticated user may enter; admins can view
 * client dashboards ("View as client"). RLS still scopes all data reads.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <AppShell user={user} homeHref="/dashboard">
      {children}
    </AppShell>
  );
}
