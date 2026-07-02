/**
 * Central constants. CLAUDE.md hard rule #7: platform API versions are pinned
 * HERE and nowhere else. Check sunset dates quarterly (docs 06/07):
 *   - Google Ads: https://developers.google.com/google-ads/api/docs/sunset-dates
 *   - Meta Marketing API: ~12-month version lifetime.
 */

// --- Platform API versions (pin in exactly one place) ---
export const GADS_API_VERSION = "v24"; // Google Ads REST; sunset ~May 2027
export const META_API_VERSION = "v25.0"; // Meta Graph/Marketing API; v24.0 expires Oct 2026

// --- Platform API base URLs ---
export const GA4_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";
export const GA4_ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";
export const GSC_BASE = "https://searchconsole.googleapis.com/webmasters/v3";
export const GADS_BASE = `https://googleads.googleapis.com/${GADS_API_VERSION}`;
export const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// --- Google OAuth scopes (one agency grant covers all three read APIs) ---
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/adwords",
] as const;

// --- Sync windows (days), per docs 04–07 ---
export const NIGHTLY_WINDOW_DAYS = 35; // absorbs platform restatements
export const REFRESH_WINDOW_DAYS = 7; // client Refresh button
export const RECONCILE_WINDOW_DAYS = 90; // monthly reconciliation cron
export const BACKFILL_MONTHS = 13; // initial backfill on assignment

// --- Refresh button rate limit ---
export const REFRESH_RATE_LIMIT_MINUTES = 10;

// --- Backoff (lib/integrations/shared/backoff.ts) ---
export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_MAX_RETRIES = 3;

// --- Source enum (mirrors the `source_type` domain in the DB) ---
export const SOURCES = ["ga4", "gsc", "google_ads", "meta_ads"] as const;
export type Source = (typeof SOURCES)[number];
