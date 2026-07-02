import Link from "next/link";
import { listClients } from "@/lib/data/clients";
import { CreateClientDialog } from "@/components/admin/create-client-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export default async function ClientsPage() {
  const clients = await listClients(true); // include archived
  const active = clients.filter((c) => !c.is_archived);
  const archived = clients.filter((c) => c.is_archived);
  const ordered = [...active, ...archived];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-muted-foreground text-sm">
            {active.length} active
            {archived.length > 0 ? ` · ${archived.length} archived` : ""}
          </p>
        </div>
        <CreateClientDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          {ordered.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No clients yet. Create your first one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: c.brand_color ?? "#e5e7eb" }}
                          aria-hidden
                        />
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.slug}
                    </TableCell>
                    <TableCell>{c.currency}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.timezone}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.is_archived ? (
                        <Badge variant="outline">Archived</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
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
