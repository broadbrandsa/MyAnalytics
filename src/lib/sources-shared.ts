// Client-safe source metadata + row types (NO server-only import — this is
// pulled into client components like sources-manager.tsx).
import type { Database } from "@/lib/database.types";
import type { Source } from "@/lib/constants";

export type DataSourceRow = Database["public"]["Tables"]["data_sources"]["Row"];

export interface SourceHealthRow extends DataSourceRow {
  clients: { name: string } | null;
}

export const SOURCE_META: Record<
  Source,
  { label: string; provider: "google" | "meta" }
> = {
  ga4: { label: "Google Analytics 4", provider: "google" },
  gsc: { label: "Search Console", provider: "google" },
  google_ads: { label: "Google Ads", provider: "google" },
  meta_ads: { label: "Meta Ads", provider: "meta" },
};
