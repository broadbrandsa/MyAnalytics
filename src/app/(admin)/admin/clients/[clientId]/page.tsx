import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { getClient } from "@/lib/data/clients";
import { listDataSources } from "@/lib/data/sources";
import { SourcesManager } from "@/components/admin/sources-manager";
import { updateClientOrg } from "@/lib/actions/clients";
import { ClientForm } from "@/components/admin/client-form";
import { ArchiveClientButton } from "@/components/admin/archive-client-button";
import { AccessCodeCard } from "@/components/admin/access-code-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getClient(clientId);
  if (!client) notFound();

  const dataSources = await listDataSources(clientId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/clients"
          className="text-muted-foreground text-sm hover:underline"
        >
          ← Clients
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-block size-6 rounded-full"
            style={{ backgroundColor: client.brand_color ?? "#e5e7eb" }}
            aria-hidden
          />
          <div>
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            <p className="text-muted-foreground text-sm">{client.slug}</p>
          </div>
          {client.is_archived && <Badge variant="outline">Archived</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/clients/${clientId}/preview`} />}
          >
            <Eye className="size-4" />
            View as client
          </Button>
          <ArchiveClientButton
            clientId={clientId}
            archived={client.is_archived}
          />
        </div>
      </div>

      <Tabs defaultValue="access">
        <TabsList>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="sources">Data sources</TabsTrigger>
        </TabsList>

        <TabsContent value="access" className="mt-4">
          <AccessCodeCard clientId={clientId} code={client.access_code} />
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding &amp; settings</CardTitle>
            </CardHeader>
            <CardContent className="max-w-xl">
              <ClientForm
                action={updateClientOrg.bind(null, clientId)}
                defaults={client}
                submitLabel="Save changes"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Data sources</CardTitle>
              <CardDescription>
                Assign platform accounts to this client. Connect Google &amp;
                Meta first under{" "}
                <Link href="/admin/connections" className="underline">
                  Connections
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SourcesManager clientId={clientId} sources={dataSources} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
