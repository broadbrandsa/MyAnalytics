import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure HMAC sign/verify for the client access cookie. Kept separate from
 * cookie.ts (which imports next/headers) so it can be unit-tested. Value format
 * is `${clientId}.${base64url(HMAC(clientId))}`.
 */
function sign(clientId: string): string {
  return createHmac("sha256", process.env.ACCESS_COOKIE_SECRET!)
    .update(clientId)
    .digest("base64url");
}

export function makeCookieValue(clientId: string): string {
  return `${clientId}.${sign(clientId)}`;
}

export function verifyCookieValue(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot < 0) return null;
  const clientId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(clientId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return clientId;
}
