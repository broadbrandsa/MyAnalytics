import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessClientId } from "@/lib/access/cookie";
import { isAdmin, type AppRole } from "@/lib/auth";
import { CodeEntry } from "@/components/code-entry";

/**
 * Public landing = client code entry. A valid access cookie whose client still
 * exists is sent straight to the dashboard; a signed-in admin goes to the portal.
 * A stale cookie (deleted/archived client) falls through to the code form rather
 * than looping — the cookie is replaced on the next successful entry.
 */
export default async function Home() {
  const accessClientId = await getAccessClientId();
  if (accessClientId) {
    const svc = createServiceClient();
    const { data: client } = await svc
      .from("clients")
      .select("id, is_archived")
      .eq("id", accessClientId)
      .maybeSingle();
    if (client && !client.is_archived) redirect("/dashboard");
  }

  // If a Broadbrand admin is already signed in, take them to the portal.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (profile && isAdmin(profile.role as AppRole)) redirect("/admin");
  }

  return <CodeEntry />;
}
