import { BACKOFF_BASE_MS, BACKOFF_MAX_RETRIES } from "@/lib/constants";

/**
 * Exponential backoff with full jitter. CLAUDE.md convention: max 3 retries,
 * then record and defer to the next run — NEVER busy-wait inside a function
 * beyond the function budget.
 *
 * `shouldRetry` decides which errors are transient (429 / RESOURCE_EXHAUSTED /
 * Meta code 80000, etc.). Non-retryable errors throw immediately so the caller
 * can map them to the doc 04–07 error tables.
 */
export interface RetryOptions {
  maxRetries?: number;
  baseMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  /** Optional explicit delay (ms) from a rate-limit header; overrides computed backoff. */
  retryAfter?: (error: unknown) => number | undefined;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = BACKOFF_MAX_RETRIES,
    baseMs = BACKOFF_BASE_MS,
    shouldRetry = () => true,
    retryAfter,
    onRetry,
  } = opts;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(error)) throw error;

      const explicit = retryAfter?.(error);
      // Full jitter: random between 0 and the exponential ceiling.
      const ceiling = baseMs * 2 ** (attempt - 1);
      const delayMs = explicit ?? Math.floor(Math.random() * ceiling);

      onRetry?.(attempt, delayMs, error);
      await sleep(delayMs);
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
