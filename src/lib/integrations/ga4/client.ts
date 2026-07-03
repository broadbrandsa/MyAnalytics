import "server-only";
import { GA4_ADMIN_BASE } from "@/lib/constants";
import { googleFetchJson } from "@/lib/integrations/shared/google-fetch";
import {
  parseGa4Properties,
  type Ga4Property,
} from "@/lib/integrations/ga4/types";

/**
 * Lists GA4 properties visible to the agency Google identity, flattened from
 * accountSummaries (paginated). Store `property` ("properties/123456") as
 * data_sources.external_id.
 */
export async function listGa4Properties(
  accessToken: string,
): Promise<Ga4Property[]> {
  const out: Ga4Property[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GA4_ADMIN_BASE}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const json = await googleFetchJson(url.toString(), accessToken);
    const { properties, nextPageToken } = parseGa4Properties(json);
    out.push(...properties);
    pageToken = nextPageToken;
  } while (pageToken);

  return out;
}
