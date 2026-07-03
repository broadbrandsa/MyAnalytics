import "server-only";

/**
 * Validates a cron/internal request's bearer token against CRON_SECRET.
 * CLAUDE.md hard rule #8: cron routes must check this before doing anything.
 * Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` when the
 * env var exists.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
