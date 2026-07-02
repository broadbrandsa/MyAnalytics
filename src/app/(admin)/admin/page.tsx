import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Admin home. Phase 1 fleshes this out into client CRUD + user invites;
 * for now it lists clients (admins read all via RLS) to prove the wiring.
 */
export default async function AdminHome() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, slug, is_archived, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground text-sm">
          Manage clients, connections, and dashboards.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            {clients?.length ?? 0} client{clients?.length === 1 ? "" : "s"}.
            Client management arrives in Phase 1.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients && clients.length > 0 ? (
            <ul className="divide-y">
              {clients.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{c.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {c.slug}
                    {c.is_archived ? " · archived" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No clients yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
