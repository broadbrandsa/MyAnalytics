import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Per-IP rate limit for code entry — the key mitigation for short numeric codes.
 * A rolling window of MAX_ATTEMPTS failures per WINDOW; once exceeded, entry is
 * blocked until the window rolls over. Backed by the access_attempts table
 * (service-role only), so it holds across serverless instances.
 */
const WINDOW_MS = 10 * 60_000; // 10 minutes
const MAX_ATTEMPTS = 10;

export interface RateStatus {
  limited: boolean;
  retryAfter: number; // seconds until the window resets
}

export async function checkRateLimit(ip: string): Promise<RateStatus> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("access_attempts")
    .select("count, window_start")
    .eq("ip", ip)
    .maybeSingle();

  if (!data) return { limited: false, retryAfter: 0 };

  const started = new Date(data.window_start).getTime();
  const elapsed = Date.now() - started;
  if (elapsed >= WINDOW_MS) return { limited: false, retryAfter: 0 };

  if (data.count >= MAX_ATTEMPTS) {
    return { limited: true, retryAfter: Math.ceil((WINDOW_MS - elapsed) / 1000) };
  }
  return { limited: false, retryAfter: 0 };
}

export async function recordFailedAttempt(ip: string): Promise<void> {
  const svc = createServiceClient();
  const now = Date.now();
  const { data } = await svc
    .from("access_attempts")
    .select("count, window_start")
    .eq("ip", ip)
    .maybeSingle();

  const windowExpired =
    !data || now - new Date(data.window_start).getTime() >= WINDOW_MS;

  await svc.from("access_attempts").upsert(
    {
      ip,
      count: windowExpired ? 1 : data!.count + 1,
      window_start: windowExpired
        ? new Date(now).toISOString()
        : data!.window_start,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "ip" },
  );
}

export async function clearAttempts(ip: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from("access_attempts").delete().eq("ip", ip);
}
