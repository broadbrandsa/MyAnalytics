import { redirect } from "next/navigation";
import { requireUser, isAdmin } from "@/lib/auth";

/**
 * Entry point: route users to the surface for their role.
 * (Unauthenticated users are already redirected to /login by proxy.ts.)
 */
export default async function Home() {
  const user = await requireUser();
  redirect(isAdmin(user.role) ? "/admin" : "/dashboard");
}
