import { randomInt } from "node:crypto";

/**
 * Client access-code format. 4 digits per the product decision — bump to 6 for
 * 1,000,000 combinations (recommended for spend/revenue dashboards) by changing
 * this one constant. Entry is rate-limited regardless (see rate-limit.ts).
 */
export const CODE_LENGTH = 4;

const CODE_RE = new RegExp(`^\\d{${CODE_LENGTH}}$`);

export function isValidCodeFormat(code: string): boolean {
  return CODE_RE.test(code);
}

/** A random zero-padded numeric code of CODE_LENGTH digits. */
export function generateCode(): string {
  const max = 10 ** CODE_LENGTH;
  return String(randomInt(0, max)).padStart(CODE_LENGTH, "0");
}
