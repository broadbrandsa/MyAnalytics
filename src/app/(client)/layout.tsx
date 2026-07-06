import { redirect } from "next/navigation";
import { getAccessClientId } from "@/lib/access/cookie";

/**
 * Client dashboard gate. Access is by code, not login: a valid signed access
 * cookie is required, otherwise back to the code-entry page. The dashboard
 * chrome (sidebar) is rendered by DashboardScreen.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientId = await getAccessClientId();
  if (!clientId) redirect("/");
  return children;
}
