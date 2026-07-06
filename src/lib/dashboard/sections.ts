// Dashboard section identity + config helpers (client-safe: shared by the
// dashboard view and the admin editor).

export type SectionKey = "overview" | "ga4" | "google_ads" | "meta_ads" | "gsc";

export interface SectionSetting {
  key: SectionKey;
  enabled: boolean;
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  overview: "Overview",
  ga4: "Google Analytics 4",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  gsc: "Search Console",
};

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "overview",
  "ga4",
  "google_ads",
  "meta_ads",
  "gsc",
];

export function defaultSections(): SectionSetting[] {
  return DEFAULT_SECTION_ORDER.map((key) => ({ key, enabled: true }));
}

/**
 * Coerce arbitrary stored config into a complete, valid ordered section list:
 * keep recognized entries in their saved order, then append any missing
 * sections (enabled) so new sources always appear.
 */
export function normalizeSections(input: unknown): SectionSetting[] {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<SectionKey>();
  const out: SectionSetting[] = [];

  for (const raw of arr) {
    const key = (raw as { key?: string })?.key as SectionKey | undefined;
    if (!key || !(key in SECTION_LABELS) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, enabled: (raw as { enabled?: boolean })?.enabled !== false });
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) out.push({ key, enabled: true });
  }
  return out;
}
