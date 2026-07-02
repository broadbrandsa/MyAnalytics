# 07 — Integration: Meta Ads (Marketing API / Ads Insights)

## API facts (verified July 2026)

- **Current version: v25.0** (Feb 2026). Base: `https://graph.facebook.com/v25.0/`. Marketing API versions live ~1 year (v24.0 expires Oct 2026). **Pin version in one constant.**
- **Permission needed: `ads_read` only** (read-only insights; "custom dashboards and data analytics" is its documented allowed usage). `business_management` optional for business-level account enumeration. `read_insights` is for Page insights — NOT needed.
- **Auth model: system-user token** under Broadbrand's Business Manager (see below). No per-client OAuth, no App Review for public users needed — the app stays effectively internal.
- **Rate limits (BUC, per ad account, rolling hour):** dev tier `600 + 400×active_ads` insights calls/hr; standard tier `190,000 + 400×active_ads`. Monitor `x-business-use-case-usage`, `x-fb-ads-insights-throttle` headers; back off at 90%. Throttle error: `code 80000, subcode 2446079`. Data-per-call cap error: `code 100, subcode 1487534`.
- Insights data retention: **37 months**; rows freeze 28 days after reporting; reported in the **ad account's timezone**.
- All server calls include `appsecret_proof = HMAC-SHA256(access_token, app_secret)`.

## Token lifecycle (build this first)

**Bootstrap note:** installing the app on a system user requires the upper Marketing API tier, which itself requires ≥500 API calls/15 days. So launch sequence is: (a) start with an **admin's long-lived user token** (60-day, obtained via the same `fb_exchange_token` flow below minus `set_token_expires_in_60_days`) stored in `oauth_credentials` exactly like a system-user token — the code path is identical; (b) accumulate call volume in dev tier; (c) request the tier, create the system-user token, paste it in, deactivate the user-token credential. No code changes between (a) and (c).

Use **expiring 60-day system-user tokens** (Meta is pushing all integrations onto these):

1. Admin generates token in Business Manager (system user → generate token → app → scope `ads_read,business_management`) and pastes into admin UI → Vault; store `expires_at`.
2. **Weekly cron** re-exchanges:
   ```
   GET /v25.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={META_APP_ID}
     &client_secret={META_APP_SECRET}
     &set_token_expires_in_60_days=true
     &fb_exchange_token={current_token}
   ```
   → `vault.update_secret`, update `expires_at = now() + expires_in`. Zero-downtime: refresh, verify with a `/me` call, then treat new token as current.
3. If exchange fails or `expires_at < 14 days` with failures: alert admin (`needs_reauth`).

## Source listing (admin picker)

```
GET /v25.0/me/adaccounts?fields=id,name,account_status,currency,timezone_name&limit=100
```
With the system-user token this returns accounts **assigned to the system user**. `id` is `act_<ACCOUNT_ID>` — store as `external_id`. `account_status`: 1=active. Cursor-paginate (`paging.next`).

If `business_management` granted, alternative enumeration: `GET /{business_id}/client_ad_accounts` (accounts shared by clients as partner).

## Sync query

```
GET /v25.0/act_{ACCOUNT_ID}/insights
  ?level=campaign
  &fields=campaign_id,campaign_name,impressions,clicks,spend,cpm,cpc,ctr,reach,actions,date_start
  &time_range={"since":"2026-05-28","until":"2026-07-01"}
  &time_increment=1
  &limit=500
  &access_token=...&appsecret_proof=...
```

- `time_increment=1` → one row per campaign per day → `metrics_meta_daily`.
- Second call at `level=account` (same params minus campaign fields) → `TOTAL` rows, and the only reliable source of `reach` (reach is not summable across campaigns/days).
- `actions` is `[{action_type, value}]`. Store raw jsonb; extract `conversions` using the source's configured primary action type (default order of preference: `offsite_conversion.fb_pixel_purchase` → `purchase` → `lead` → `offsite_conversion.fb_pixel_lead`; configurable in `data_sources.config.primary_action`).
- Attribution: rely on ad-set attribution defaults (since June 2025 the API mirrors Ads Manager; `use_unified_attribution_setting` is disregarded).
- Cursor-paginate via `paging.next` URLs.

## Async jobs (backfill)

Sync GETs over long ranges can hit the data-per-call cap (`subcode 1487534`). For backfill months, use async:

1. `POST /act_{id}/insights` (same params) → `{report_run_id}`
2. Poll `GET /{report_run_id}` until `async_status = "Job Completed"` (poll every 10s, in-function up to budget; else re-queue)
3. `GET /{report_run_id}/insights` → paginate results. Report runs expire after 30 days.

Nightly 35-day windows are fine synchronously; switch to async on first 1487534 error.

## Windows

- Nightly: last 35 days (rows freeze at 28 days; 35 covers it). Backfill: 13 months, month chunks, async. Refresh: last 7 days.

## Error handling

| Error | Action |
|---|---|
| code 190 (invalid/expired token) | `needs_reauth`, alert admin |
| code 80000 / subcode 2446079 | Read `estimated_time_to_regain_access` from BUC header; defer source to next run |
| code 100 / subcode 1487534 | Halve the window and retry; if backfill, switch to async job |
| code 4 / subcode 1504022 | Global load shedding — back off 15 min, defer |
| Account disappears from /me/adaccounts | Client unshared / unassigned from system user → deactivate source, alert |

## Setup dependencies (see doc 08)

Meta Business-type app; Business Verification for Broadbrand BM; clients share ad accounts to Broadbrand BM via partner access; system user created with app installed and accounts assigned ("View performance" task). Note: installing an app on a system user requires the upper Marketing API tier ("Full Access", renamed from "Ads Management Standard Access" in May 2026) — eligibility: ≥500 API calls in past 15 days with <15% error rate, requested from App Dashboard (no screencast needed anymore). Bootstrap path: develop in dev tier with an admin user token, apply for the tier once call volume exists.
