# 06 — Integration: Google Ads API

## API facts (verified July 2026)

- **Current version: v24** (v24.1 released 2026-05-13). Since Jan 2026: roughly quarterly major versions with monthly point releases; each major supported ~12 months. **Sunsets:** v20 June 2026, v21 Aug 2026, v22 Oct 2026, v23 ~Feb 2027, v24 ~May 2027. **Pin the version string in one constant** and check https://developers.google.com/google-ads/api/docs/sunset-dates quarterly.
- **Scope:** `https://www.googleapis.com/auth/adwords` (no read-only variant).
- **Developer token** from the Broadbrand MCC's API Center. Access levels: Test (default, test accounts only) → **Basic (15,000 operations/day — apply via form, days-to-weeks)** → Standard (unlimited, separate application). Basic is sufficient for this dashboard.
- **Use REST, not gRPC**, in Vercel functions: `POST https://googleads.googleapis.com/v24/customers/{customerId}/googleAds:searchStream` with JSON. (The Opteo `google-ads-api` npm lib is solid but pulls gRPC weight; REST keeps functions lean.)
- Required headers on every call:
  ```
  Authorization: Bearer {access_token}
  developer-token: {GOOGLE_ADS_DEVELOPER_TOKEN}
  login-customer-id: {Broadbrand MCC id, digits only}
  ```

## Source listing (admin picker)

1. `GET https://googleads.googleapis.com/v24/customers:listAccessibleCustomers` — accounts the authorized user can access directly.
2. Expand MCC hierarchy via GAQL against the MCC customer id:
   ```sql
   SELECT customer_client.id, customer_client.descriptive_name,
          customer_client.manager, customer_client.status
   FROM customer_client
   WHERE customer_client.level <= 2
   ```
   Filter out `manager = true`; present client accounts for assignment. Store the 10-digit `customer_client.id` as `external_id`.

## Sync query

`POST .../v24/customers/{customerId}/googleAds:searchStream`

```json
{
  "query": "SELECT segments.date, campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '2026-05-28' AND '2026-07-01' ORDER BY segments.date"
}
```

- One call per client account per window → `metrics_gads_daily` (per campaign; compute `TOTAL` row per date by summing — these metrics are all summable).
- `cost_micros / 1_000_000` → `cost` numeric at write time.
- Zero-impression campaign-days simply don't appear — fine.
- searchStream returns an **array of response chunks** `[{results[], fieldMask}, ...]`; concatenate `results`. Values arrive under nested keys (`segments.date`, `metrics.costMicros` — REST uses lowerCamelCase). Parse with zod.

## Account currency

`SELECT customer.currency_code, customer.descriptive_name FROM customer` once per source at assignment; store in `data_sources.config.currency`. Display currency per source; only aggregate cross-platform spend when currencies match (else show both).

## Windows

- Nightly: last 35 days. Backfill: 13 months, month chunks. Refresh: last 7 days.
- Conversions restate for up to 30 days (conversion lag) — the 35-day window handles it; the monthly 90-day reconciliation catches stragglers.

## Error handling

| Error | Action |
|---|---|
| `UNAUTHENTICATED` / `invalid_grant` | Mark credential `needs_reauth` |
| `AUTHORIZATION_ERROR: USER_PERMISSION_DENIED` | Account no longer linked to MCC → deactivate source, alert admin |
| `RESOURCE_EXHAUSTED` | Exponential backoff (30s base, 3 retries), then defer to next run |
| `AUTHENTICATION_ERROR: DEVELOPER_TOKEN_NOT_APPROVED` | Token still Test-level — pre-launch checklist item |
| Version sunset warnings in response headers | Log loudly; bump version constant |

## Setup dependencies (see doc 08)

Client accounts must be linked under the Broadbrand MCC (client accepts link invitation from MCC). Basic Access application requires: RMF-compliant tool description (internal reporting dashboards are a standard approved use), privacy policy URL, MCC in good standing. Apply in week 1 — this is the longest external dependency.
