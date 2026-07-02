# 01 — Product Requirements

## Summary

A white-label analytics portal ("Broadbrand Analytics") where Broadbrand's clients log in and view a live dashboard of their marketing performance across Meta Ads, Google Ads, Google Analytics 4, and Google Search Console. Broadbrand admins connect the data sources, configure each client's dashboard, and manage users. Clients get a read-only view with a Refresh button — like a Looker Studio report, minus the editor.

## Users & roles

| Role | Who | Can do |
|---|---|---|
| `super_admin` | Broadbrand staff | Everything: manage clients, connections, dashboards, users, view all data |
| `admin` | Broadbrand staff | Same as super_admin minus billing/destructive ops (delete client) |
| `client_viewer` | Client users | View their client's dashboards, use Refresh, export/print. No editing, no visibility into other clients |

One client organization can have multiple `client_viewer` users. A Broadbrand admin can preview any client's dashboard exactly as the client sees it ("View as client").

## Core features (v1)

### F1 — Client management (admin)
- Create/archive client orgs (name, logo, brand color, timezone, currency).
- Invite client users by email (Supabase invite flow — no public signup).
- Deactivate users.

### F2 — Data source connections (admin only)
- Connect Google (one agency-level OAuth grant covering GA4 + Search Console + Google Ads scopes; token stored encrypted).
- Connect Meta (system-user token from Broadbrand Business Manager, entered/stored once).
- Per client, assign: a GA4 property, a Search Console site, one or more Google Ads customer IDs, one or more Meta ad account IDs. Pickers populated from the APIs (account/property/site listing endpoints).
- Connection health indicators (last sync, last error, token status).

### F3 — Metric sync
- Nightly automatic sync of all active connections (per-client fan-out).
- Rolling re-fetch window (last 35 days) to absorb platform data restatements (GA4/Ads restate recent days; GSC finalizes ~3 days late; Meta freezes after 28 days).
- Initial backfill on assignment: 13 months (GSC capped at 16 months; Meta at 37 months — fetch 13 for consistency).
- Manual Refresh (client-facing button): re-syncs last 7 days for that client only, rate-limited to once per 10 minutes per client, with progress feedback.

### F4 — Dashboards
- **Client view:** date-range picker (presets: 7/28/30/90 days, this/last month, custom; comparison vs previous period), KPI scorecards, time-series charts, tables, channel breakdowns. Auto-loads from cached data instantly. "Data updated X ago" indicator + Refresh button.
- **Admin editor:** per client, toggle which sections/widgets appear, reorder them, set default date range, add annotation notes. Config stored as JSON — no drag-drop canvas needed in v1; a structured settings form is sufficient.
- **Default template** (applies to every new client, per connected source):
  - Overview: spend (Meta + Google Ads combined), sessions, key events/conversions, ROAS-style summary
  - Google Ads: spend, impressions, clicks, CTR, avg CPC, conversions, conv. value, by-campaign table, spend/conversions time series
  - Meta Ads: spend, impressions, reach, clicks, CTR, CPC, CPM, conversions (actions), by-campaign table, time series
  - GA4: sessions, total/new users, engagement rate, key events, sessions by default channel group (time series + donut), top landing pages table, device split
  - Search Console: clicks, impressions, CTR, avg position (time series), top queries table, top pages table
- Widgets render empty-state gracefully when a source isn't connected.

### F5 — Branding
- Broadbrand-branded portal; client logo + name on their dashboard. Sub-brand theming consistent with existing Broadbrand house style (see deck-builder brand assets: DSG/Broadbrand palette).

## Non-goals (v1)
- Client-side dashboard editing or widget marketplace
- Scheduled PDF/email reports (v2)
- Other sources (LinkedIn, TikTok, Shopify…) — schema must not preclude them (`source` is an open enum)
- Cross-client benchmarking
- Real-time (intraday) data — daily grain only, plus "today so far" is out of scope v1
- Client self-serve OAuth connect flows (deliberately excluded — avoids Meta App Review Advanced Access and Google app verification for external users)

## Success criteria
- Dashboard first paint < 1s from cache (no platform API call in request path)
- Nightly sync completes for 50 clients within cron window; single-client failure doesn't block others
- A new client fully onboarded (org + sources assigned + backfill done) in < 15 minutes of admin time
- Zero cross-tenant data leakage (RLS-enforced, tested)

## Key risks
| Risk | Mitigation |
|---|---|
| Google Ads API Basic Access application delay | Apply in week 1 (doc 08); develop against test accounts meanwhile |
| Google OAuth app left in "Testing" → refresh token dies every 7 days | Publish consent screen to Production immediately (doc 08) |
| Meta system-user token expiry policy shifts (Meta pushing 60-day expiring tokens) | Build the 60-day token refresh job from day one (doc 07) |
| Platform API version churn (Google Ads ~12-month sunsets, Meta ~12-month Marketing API expiry) | Version pinned in one config module per integration; upgrade task scheduled quarterly |
