# 05 — Integration: Google Search Console

## API facts (verified July 2026)

- **Search Console API v1**, legacy paths preserved: base `https://searchconsole.googleapis.com/webmasters/v3/`
- **Scope:** `https://www.googleapis.com/auth/webmasters.readonly`
- **16-month history hard limit**; finalized data lags ~2–3 days (`dataState: "all"` returns fresh-but-revisable data).
- Row limits: `rowLimit` max 25,000/request, paginate with `startRow`; API exposes max 50k rows/day/site/search-type sorted by clicks; anonymized queries omitted (query-level sums < totals — expected, don't "fix").
- Quotas: 1,200 QPM per site, 1,200 QPM per user, 40k QPM per project. Query+page grouped requests are the most expensive; on quota error wait 15 min.

## Source listing (admin picker)

```
GET https://searchconsole.googleapis.com/webmasters/v3/sites
```
Returns `siteEntry[{siteUrl, permissionLevel}]`. Domain properties look like `sc-domain:example.com`. Store `siteUrl` as `external_id`; **URL-encode it in request paths**.

## Sync queries

`POST https://searchconsole.googleapis.com/webmasters/v3/sites/{encodedSiteUrl}/searchAnalytics/query`

**Query 1 — daily totals → `metrics_gsc_daily`:**
```json
{
  "startDate": "2026-05-28",
  "endDate": "2026-07-01",
  "dimensions": ["date"],
  "type": "web",
  "dataState": "all",
  "rowLimit": 25000
}
```
Mark rows `is_final = metric_date <= today - 4 days`.

**Query 2 — device split (merge into `device_split` jsonb):** dimensions `["date","device"]`.

**Query 3 — top queries → `metrics_gsc_queries` (weekly grain):**
```json
{
  "startDate": "<week_start>", "endDate": "<week_end>",
  "dimensions": ["query"], "rowLimit": 1000, "dataState": "final"
}
```
One request per week in the window; store `week_start`. (Weekly grain keeps row volume sane and matches how clients read query tables.)

**Query 4 — top pages → `metrics_gsc_pages`:** same as Q3 with `dimensions: ["page"]`.

## Parsing notes

- Response: `rows[{keys[], clicks, impressions, ctr, position}]` — `keys` align with requested `dimensions` order.
- `ctr` is a fraction (0–1); `position` is float. Store as-is.
- No `rows` key = zero data for the range.

## Windows

- Nightly: last 35 days for daily totals; last 2 complete weeks for query/page tables (re-pull to absorb finalization).
- Backfill: 13 months daily; query/page tables 13 months of weeks (batch by month, respect QPM with ~100ms spacing).
- Refresh: last 7 days daily totals only (query/page tables don't change intra-week meaningfully).

## Error handling

| Error | Action |
|---|---|
| 403 `insufficientPermissions` / site not in sites.list | Agency user lost access → mark source inactive, alert admin |
| 429 / quota exceeded | Back off 15 min (record, let next cron catch up — never busy-wait in a function) |
| `invalid_grant` on token refresh | Credential `needs_reauth` |
