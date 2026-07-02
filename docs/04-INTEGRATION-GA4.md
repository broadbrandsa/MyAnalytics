# 04 — Integration: Google Analytics 4 (Analytics Data API)

## API facts (verified July 2026)

- **Data API is at v1beta** (stable surface): `https://analyticsdata.googleapis.com/v1beta/`
- **Admin API v1beta** for listing properties: `https://analyticsadmin.googleapis.com/v1beta/`
- **Scope:** `https://www.googleapis.com/auth/analytics.readonly`
- Enable both "Google Analytics Data API" and "Google Analytics Admin API" in the Cloud project.
- **`conversions` metric is deprecated → use `keyEvents`** (per-event: `keyEvents:event_name`).
- Quotas (standard property): 200,000 core tokens/property/day, 40,000/hour, 14,000/project/property/hour, 10 concurrent requests. Typical request ≤10 tokens. Send `"returnPropertyQuota": true` and log the response into `sync_runs.telemetry`.

## Source listing (admin picker)

```
GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries
Authorization: Bearer {access_token}
```
Returns accounts with nested `propertySummaries` (`property: "properties/123456"`, `displayName`). Paginated (`pageToken`). Store the chosen `properties/123456` as `data_sources.external_id`.

## Sync queries

All requests: `POST https://analyticsdata.googleapis.com/v1beta/{property}:runReport` (or `:batchRunReports` — up to 5 reports, same property, one call; use it to fetch all three reports below in one request).

**Report 1 — daily totals + channel split → `metrics_ga4_daily`:**
```json
{
  "dateRanges": [{"startDate": "2026-05-28", "endDate": "2026-07-01"}],
  "dimensions": [{"name": "date"}, {"name": "sessionDefaultChannelGroup"}],
  "metrics": [
    {"name": "sessions"}, {"name": "totalUsers"}, {"name": "newUsers"},
    {"name": "engagedSessions"}, {"name": "engagementRate"},
    {"name": "keyEvents"}, {"name": "totalRevenue"}
  ],
  "limit": 100000,
  "returnPropertyQuota": true
}
```
Compute the `TOTAL` row per date by summing channels (or run a second report without the channel dimension inside the same batch — preferred, since rates like engagementRate don't sum).

**Report 2 — daily totals (no channel) → `channel='TOTAL'` rows:** same metrics, dimensions `[date]` only.

**Report 3 — landing pages → `metrics_ga4_pages`:**
dimensions `[date, landingPage]`, metrics `[sessions, keyEvents]`, `orderBys` sessions desc, `limit: 50` per date is unnecessary — just cap total rows (e.g. 10000) and let the dashboard query top-N.

**Report 4 — device split:** dimensions `[date, deviceCategory]`, metrics `[sessions]` → merge into `metrics_ga4_daily.device_split` jsonb on the `channel='TOTAL'` row for that date (same pattern as GSC). Never store device rows in the `channel` column — it would pollute channel aggregations.

## Parsing notes

- Response shape: `dimensionHeaders[]/metricHeaders[]` + `rows[{dimensionValues[],metricValues[]}]` — all values are strings; parse with zod + Number().
- `date` dimension format is `YYYYMMDD` → convert to ISO date.
- Empty result = no `rows` key at all; treat as zero rows, not error.
- Paginate with `offset`/`limit` if `rowCount` > returned rows.

## Windows

- Nightly: last 35 days (GA4 restates recent days).
- Backfill: 13 months, month-by-month chunks.
- Refresh button: last 7 days.

## Error handling

| Error | Action |
|---|---|
| 401 `UNAUTHENTICATED` | Refresh access token from refresh token; if `invalid_grant`, mark credential `needs_reauth` |
| 403 `PERMISSION_DENIED` | Agency Google user lost access to property → mark data_source inactive, surface in admin |
| 429 `RESOURCE_EXHAUSTED` | Exponential backoff (base 30s, max 3 retries); if property tokens exhausted, record and skip until next run |
| `propertyQuota` in response shows <10% remaining | Log warning, stop non-essential reports for this property |

## Access model note

Sole model: the agency OAuth grant (the Google user must have at least Viewer on each client GA4 property). Alternative if a client won't grant the agency user: create a service account and have the client add its email as Viewer — supported by the same API without code changes to queries (only the token acquisition differs). Not built in v1; note kept for future.
