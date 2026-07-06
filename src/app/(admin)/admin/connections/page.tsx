import { Suspense } from "react";
import { listCredentials } from "@/lib/data/credentials";
import { listAllSourcesWithClient } from "@/lib/data/sources";
import { SOURCE_META } from "@/lib/data/sources";
import { MetaConnectForm } from "@/components/admin/meta-connect-form";
import { DisconnectButton } from "@/components/admin/disconnect-button";
import { ConnectionToast } from "@/components/admin/connection-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Source } from "@/lib/constants";

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="secondary">Connected</Badge>;
  if (status === "needs_reauth")
    return <Badge variant="destructive">Needs re-auth</Badge>;
  return <Badge variant="outline">Revoked</Badge>;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default async function ConnectionsPage() {
  const creds = await listCredentials();
  const google = creds.find(
    (c) => c.provider === "google" && c.status !== "revoked",
  );
  const meta = creds.find(
    (c) => c.provider === "meta" && c.status !== "revoked",
  );
  const sources = await listAllSourcesWithClient();

  const metaDays = daysUntil(meta?.expires_at ?? null);

  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <ConnectionToast />
      </Suspense>

      <div>
        <h1 className="text-2xl font-semibold">Connections</h1>
        <p className="text-muted-foreground text-sm">
          One Google agency grant (GA4 + Search Console + Ads) and one Meta
          system-user token power every client.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Google */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Google</CardTitle>
              {google && <StatusBadge status={google.status} />}
            </div>
            <CardDescription>
              GA4, Search Console, and Google Ads via one OAuth grant.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {google ? (
              <>
                <dl className="text-sm">
                  <div className="flex justify-between py-1">
                    <dt className="text-muted-foreground">Scopes</dt>
                    <dd className="text-right">{google.scopes.length}</dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-muted-foreground">Last refreshed</dt>
                    <dd>
                      {google.last_refreshed_at
                        ? new Date(google.last_refreshed_at).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<a href="/api/oauth/google/start" />}
                  >
                    Reconnect
                  </Button>
                  <DisconnectButton provider="google" />
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">Not connected.</p>
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<a href="/api/oauth/google/start" />}
                >
                  Connect Google
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Meta */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Meta</CardTitle>
              {meta && <StatusBadge status={meta.status} />}
            </div>
            <CardDescription>
              Ads insights via a Business Manager system-user token.
              {meta && metaDays != null && (
                <>
                  {" "}
                  Expires in{" "}
                  <span className={metaDays < 14 ? "text-destructive" : ""}>
                    {metaDays} days
                  </span>
                  .
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <MetaConnectForm connected={!!meta} />
            {meta && <DisconnectButton provider="meta" />}
          </CardContent>
        </Card>
      </div>

      {/* Health panel */}
      <Card>
        <CardHeader>
          <CardTitle>Source health</CardTitle>
          <CardDescription>
            {sources.length} assigned source{sources.length === 1 ? "" : "s"}{" "}
            across all clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sources.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No sources assigned yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead className="text-right">State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.clients?.name ?? "—"}</TableCell>
                    <TableCell>{SOURCE_META[s.source as Source].label}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[240px] truncate">
                      {s.display_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.last_synced_at
                        ? new Date(s.last_synced_at).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
