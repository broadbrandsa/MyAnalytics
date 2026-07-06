import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getClient } from "@/lib/data/clients";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { Button } from "@/components/ui/button";
import type { RangeParams } from "@/lib/dashboard/range";

/**
 * "View as client" — admins preview any client's dashboard exactly as the
 * client sees it. Gated by the (admin) layout's requireAdmin(). A banner makes
 * the preview context explicit; Refresh is authorized by the admin session.
 */
export default async function ClientPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<RangeParams>;
}) {
  const { clientId } = await params;
  const client = await getClient(clientId);
  if (!client) notFound();
  const sp = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-secondary flex items-center justify-between rounded-md px-4 py-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Eye className="size-4" />
          Viewing as {client.name} — this is the client&apos;s read-only view.
        </span>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/admin/clients/${clientId}`} />}
        >
          <ArrowLeft className="size-4" />
          Back to client
        </Button>
      </div>
      <DashboardScreen
        client={client}
        params={sp}
        refreshClientId={clientId}
        embedded
      />
    </div>
  );
}
