import "server-only";

/**
 * Best-effort operational alert to a Slack-compatible webhook. No-op when
 * ALERT_WEBHOOK_URL is unset. Never throws and never includes secrets/tokens —
 * only human-readable status messages (CLAUDE.md hard rule #2).
 */
export async function sendAlert(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[Broadbrand Analytics] ${text}` }),
      cache: "no-store",
    });
  } catch {
    // Alerting is best-effort; failures must not affect the sync.
  }
}
