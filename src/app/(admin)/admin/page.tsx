import Link from "next/link";
import { ArrowRight, Building2, Plug, LayoutDashboard } from "lucide-react";
import { listClients } from "@/lib/data/clients";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminHome() {
  const clients = await listClients(true);
  const active = clients.filter((c) => !c.is_archived).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-muted-foreground text-sm">
          Manage clients, connections, and dashboards.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/clients">
          <Card className="hover:border-foreground/20 h-full transition-colors">
            <CardHeader>
              <Building2 className="text-muted-foreground size-5" />
              <CardTitle className="mt-2 text-3xl">{active}</CardTitle>
              <CardDescription>Active clients</CardDescription>
            </CardHeader>
            <CardContent className="text-primary flex items-center gap-1 text-sm">
              Manage clients <ArrowRight className="size-4" />
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full opacity-70">
          <CardHeader>
            <Plug className="text-muted-foreground size-5" />
            <CardTitle className="mt-2 text-base">Connections</CardTitle>
            <CardDescription>
              Google &amp; Meta connections — Phase 2.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="h-full opacity-70">
          <CardHeader>
            <LayoutDashboard className="text-muted-foreground size-5" />
            <CardTitle className="mt-2 text-base">Dashboards</CardTitle>
            <CardDescription>
              Per-client dashboard editor — Phase 5.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
