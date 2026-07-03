// Google Search Console — zod schemas. Sync schemas: Phase 3.
import { z } from "zod";

/** GET webmasters/v3/sites */
export const gscSiteEntrySchema = z.object({
  siteUrl: z.string(), // "sc-domain:example.com" or a URL prefix
  permissionLevel: z.string().optional(),
});

export const gscSitesListSchema = z.object({
  siteEntry: z.array(gscSiteEntrySchema).optional(),
});

export interface GscSite {
  siteUrl: string; // external_id
  permissionLevel: string;
}

/** Pure parse of the sites.list response (unit-testable). */
export function parseGscSites(json: unknown): GscSite[] {
  const parsed = gscSitesListSchema.parse(json);
  return (parsed.siteEntry ?? []).map((s) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel ?? "",
  }));
}
