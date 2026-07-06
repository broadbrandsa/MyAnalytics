import { NextResponse, type NextRequest } from "next/server";
import { clearAccessCookie } from "@/lib/access/cookie";

/** Clears the client access cookie ("exit" from a code-gated dashboard). */
export async function POST(request: NextRequest) {
  await clearAccessCookie();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
