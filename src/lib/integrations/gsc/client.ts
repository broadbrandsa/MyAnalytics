import "server-only";
import { GSC_BASE } from "@/lib/constants";
import { googleFetchJson } from "@/lib/integrations/shared/google-fetch";
import { parseGscSites, type GscSite } from "@/lib/integrations/gsc/types";

/**
 * Lists Search Console sites the agency identity can access. Store `siteUrl`
 * (e.g. "sc-domain:example.com") as external_id; URL-encode it in later request
 * paths (doc 05).
 */
export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const json = await googleFetchJson(`${GSC_BASE}/sites`, accessToken);
  return parseGscSites(json);
}
