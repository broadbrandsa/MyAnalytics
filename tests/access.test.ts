/**
 * Client access-code security: the signed cookie must round-trip, reject
 * tampering, and the code format/generation must hold. These guard the
 * no-login client access path.
 */
import { describe, expect, test, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ACCESS_COOKIE_SECRET = "test-access-secret-0123456789abcdef";
});

describe("access cookie signing", () => {
  test("valid signature resolves back to the client id", async () => {
    const { makeCookieValue, verifyCookieValue } = await import(
      "@/lib/access/sign"
    );
    const id = "11111111-2222-3333-4444-555555555555";
    const value = makeCookieValue(id);
    expect(verifyCookieValue(value)).toBe(id);
  });

  test("tampered client id is rejected (forged access)", async () => {
    const { makeCookieValue, verifyCookieValue } = await import(
      "@/lib/access/sign"
    );
    const value = makeCookieValue("client-A");
    const forged = value.replace("client-A", "client-B");
    expect(verifyCookieValue(forged)).toBeNull();
  });

  test("garbage / missing values are rejected", async () => {
    const { verifyCookieValue } = await import("@/lib/access/sign");
    expect(verifyCookieValue(undefined)).toBeNull();
    expect(verifyCookieValue("nope")).toBeNull();
    expect(verifyCookieValue("a.b.c")).toBeNull();
  });

  test("signature is secret-dependent", async () => {
    const { makeCookieValue } = await import("@/lib/access/sign");
    const withA = makeCookieValue("x");
    process.env.ACCESS_COOKIE_SECRET = "a-different-secret-value-000000000000";
    const { verifyCookieValue } = await import("@/lib/access/sign");
    // Value signed under the old secret must not verify under the new one.
    expect(verifyCookieValue(withA)).toBeNull();
    process.env.ACCESS_COOKIE_SECRET = "test-access-secret-0123456789abcdef";
  });
});

describe("access code format", () => {
  test("accepts 4 digits, rejects others", async () => {
    const { isValidCodeFormat, generateCode, CODE_LENGTH } = await import(
      "@/lib/access/codes"
    );
    expect(isValidCodeFormat("1234")).toBe(true);
    expect(isValidCodeFormat("12")).toBe(false);
    expect(isValidCodeFormat("abcd")).toBe(false);
    expect(isValidCodeFormat("12345")).toBe(false);
    const gen = generateCode();
    expect(gen).toHaveLength(CODE_LENGTH);
    expect(isValidCodeFormat(gen)).toBe(true);
  });
});
