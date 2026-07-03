// GA4 (Analytics Data/Admin API) — zod schemas. Sync-report schemas: Phase 3.
import { z } from "zod";

/** GET analyticsadmin/v1beta/accountSummaries */
export const ga4PropertySummarySchema = z.object({
  property: z.string(), // "properties/123456"
  displayName: z.string().optional(),
  propertyType: z.string().optional(),
});

export const ga4AccountSummarySchema = z.object({
  account: z.string().optional(), // "accounts/123"
  displayName: z.string().optional(),
  propertySummaries: z.array(ga4PropertySummarySchema).optional(),
});

export const ga4AccountSummariesSchema = z.object({
  accountSummaries: z.array(ga4AccountSummarySchema).optional(),
  nextPageToken: z.string().optional(),
});

export interface Ga4Property {
  property: string; // external_id, e.g. "properties/123456"
  displayName: string;
  accountName: string;
}

/** Pure parse+flatten of one accountSummaries page (unit-testable). */
export function parseGa4Properties(json: unknown): {
  properties: Ga4Property[];
  nextPageToken?: string;
} {
  const parsed = ga4AccountSummariesSchema.parse(json);
  const properties: Ga4Property[] = [];
  for (const acc of parsed.accountSummaries ?? []) {
    for (const prop of acc.propertySummaries ?? []) {
      properties.push({
        property: prop.property,
        displayName: prop.displayName ?? prop.property,
        accountName: acc.displayName ?? acc.account ?? "",
      });
    }
  }
  return { properties, nextPageToken: parsed.nextPageToken };
}
