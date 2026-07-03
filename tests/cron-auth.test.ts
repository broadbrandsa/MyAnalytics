/**
 * Cron auth guard (CLAUDE.md hard rule #8). Cron routes must reject requests
 * without the correct `Authorization: Bearer ${CRON_SECRET}`.
 */
import { describe, expect, test, beforeAll } from "vitest";
import { isAuthorizedCron } from "@/lib/cron";

const SECRET = "test-cron-secret-abc123";

beforeAll(() => {
  process.env.CRON_SECRET = SECRET;
});

function req(auth?: string): Request {
  return new Request("https://example.com/api/cron/sync", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("isAuthorizedCron", () => {
  test("accepts the correct bearer token", () => {
    expect(isAuthorizedCron(req(`Bearer ${SECRET}`))).toBe(true);
  });

  test("rejects a missing header", () => {
    expect(isAuthorizedCron(req())).toBe(false);
  });

  test("rejects a wrong token", () => {
    expect(isAuthorizedCron(req("Bearer nope"))).toBe(false);
  });

  test("rejects a bare token without the Bearer scheme", () => {
    expect(isAuthorizedCron(req(SECRET))).toBe(false);
  });
});
