import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getClient } from "@/lib/data/clients";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { Button } from "@/components/ui/button";

/**
 * "View as client" — admins preview any client's dashboard exactly as the
 * client sees it. Gated by the (admin) layout's requireAdmin(); admins read any
 * client via RLS. A banner makes the preview context explicit.
 */
export default async function ClientPreviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getClient(clientId);
  if (!client) notFound();

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
          render={<Link href={`/admin/clients/${clientId}`} />}
        >
          <ArrowLeft className="size-4" />
          Back to client
        </Button>
      </div>
      <ClientDashboard client={client} />
    </div>
  );
}
