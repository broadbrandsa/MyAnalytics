import { redirect } from "next/navigation";
import { getAccessClientId } from "@/lib/access/cookie";
import { ClientShell } from "@/components/client-shell";

/**
 * Client dashboard shell. Access is by code, not login: a valid signed access
 * cookie is required, otherwise back to the code-entry page. All data reads are
 * explicitly scoped to the cookie's client_id (see the dashboard page).
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientId = await getAccessClientId();
  if (!clientId) redirect("/");

  return <ClientShell>{children}</ClientShell>;
}
