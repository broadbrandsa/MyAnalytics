// Google Ads (REST) — zod schemas. Sync-report schemas: Phase 3.
import { z } from "zod";

/**
 * customer_client rows from googleAds:searchStream. REST returns lowerCamelCase
 * keys; numeric ids arrive as strings.
 */
export const gadsCustomerClientSchema = z.object({
  id: z.string(), // 10-digit customer id
  descriptiveName: z.string().optional(),
  manager: z.boolean().optional(),
  status: z.string().optional(), // ENABLED, CANCELED, ...
  currencyCode: z.string().optional(),
  timeZone: z.string().optional(),
});

export const gadsSearchStreamResponseSchema = z.array(
  z.object({
    results: z
      .array(z.object({ customerClient: gadsCustomerClientSchema }))
      .optional(),
  }),
);

export interface GadsAccount {
  id: string; // external_id, 10-digit
  descriptiveName: string;
  currencyCode: string | null;
  timeZone: string | null;
}

/**
 * Pure parse+filter of a customer_client searchStream response
 * (unit-testable): drops manager accounts and non-ENABLED accounts, dedupes.
 */
export function parseGadsAccounts(json: unknown): GadsAccount[] {
  const chunks = gadsSearchStreamResponseSchema.parse(json);
  const seen = new Set<string>();
  const out: GadsAccount[] = [];

  for (const chunk of chunks) {
    for (const row of chunk.results ?? []) {
      const cc = row.customerClient;
      if (cc.manager) continue; // skip sub-MCCs
      if (cc.status && cc.status !== "ENABLED") continue;
      if (seen.has(cc.id)) continue;
      seen.add(cc.id);
      out.push({
        id: cc.id,
        descriptiveName: cc.descriptiveName ?? cc.id,
        currencyCode: cc.currencyCode ?? null,
        timeZone: cc.timeZone ?? null,
      });
    }
  }
  return out;
}
