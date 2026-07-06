import "server-only";
import { cookies } from "next/headers";
import { makeCookieValue, verifyCookieValue } from "@/lib/access/sign";

/**
 * Client access cookie helpers (read/set/clear). The signed value proves the
 * visitor entered a valid code for a client, without a Supabase account. The
 * signed client_id is then used to read ONLY that client's cached metrics (via
 * service-role, explicitly filtered by client_id). httpOnly so JS can't read it.
 */
export const ACCESS_COOKIE = "bb_access";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export { makeCookieValue, verifyCookieValue };

/** Read + verify the access cookie from the request. */
export async function getAccessClientId(): Promise<string | null> {
  const store = await cookies();
  return verifyCookieValue(store.get(ACCESS_COOKIE)?.value);
}

export async function setAccessCookie(clientId: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, makeCookieValue(clientId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearAccessCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
}
