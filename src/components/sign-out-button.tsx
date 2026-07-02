import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

/** Posts to the sign-out route handler (clears the Supabase session cookies). */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="size-4" />
        Sign out
      </Button>
    </form>
  );
}
