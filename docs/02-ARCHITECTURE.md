# 02 — Architecture

## Overview

```
┌─────────────────────────── Vercel ───────────────────────────┐
│  Next.js 16 App Router                                       │
│                                                              │
│  /app/(client)/...      RSC dashboards (read Supabase only)  │
│  /app/(admin)/...       Admin portal (Server Actions)        │
│  /app/api/cron/sync     Nightly cron entry (fan-out)         │
│  /app/api/sync/[dataSourceId]   Per-source sync worker       │
│  /app/api/refresh       Client Refresh button endpoint       │
│  /app/api/oauth/google/ callback  Admin Google OAuth         │
│  proxy.ts               Supabase session refresh             │
└──────────┬───────────────────────────┬───────────────────────┘
           │ @supabase/ssr             │ service-role key (server only)
┌──────────▼───────────────────────────▼───────────────────────┐
│  Supabase                                                    │
│  Auth (invite-only) · Postgres (RLS multi-tenant)            │
│  Vault (OAuth refresh tokens, Meta system-user token)        │
└──────────────────────────────────────────────────────────────┘
           ▲ sync workers fetch ▼ upsert metrics
┌──────────┴───────────────────────────────────────────────────┐
│  Platform APIs                                               │
│  GA4 Data API v1beta · Search Console API v1                 │
│  Google Ads API v24 (REST) · Meta Graph API v25.0            │
└──────────────────────────────────────────────────────────────┘
```

**Cardinal rule:** dashboard page loads never call platform APIs. All reads come from `metrics_*` tables in Postgres. Platform APIs are only touched by sync workers (cron or Refresh-triggered).

## Versions & libraries (pin these)

| Thing | Version / choice | Why |
|---|---|---|
| Next.js | 16.x, App Router, Turbopack | Current stable; `proxy.ts` (renamed from middleware) runs Node runtime |
| React | 19 | Required by Next 16 |
| Supabase client | `@supabase/ssr` + `@supabase/supabase-js` | `auth-helpers-nextjs` is deprecated |
| Google APIs | Plain REST via `fetch` for GA4/GSC/Ads | Avoids gRPC weight in serverless; Google Ads REST `searchStream` is first-class. `googleapis` npm optional for GA4/GSC |
| Meta | Plain REST via `fetch`, Graph API v25.0 | SDK unnecessary for insights reads |
| Charts | shadcn/ui charts (Recharts v3) | De-facto standard; Tremor is maintenance-mode |
| CSS | Tailwind v4 | Default in create-next-app |
| Validation | zod | Parse all external API responses |

## Auth & tenancy

- **Supabase Auth**, email/password + magic link. Public signup disabled; users created via `auth.admin.inviteUserByEmail()` from a Server Action.
- `profiles` row per user with `role` (`super_admin` | `admin` | `client_viewer`); `memberships` links client_viewer users to a client org.
- **RLS everywhere** (doc 03). Client reads go through the user's Supabase session (anon key + RLS). Sync writes and admin cross-tenant reads use the service-role key, server-side only.
- Route protection in `proxy.ts` + per-layout `supabase.auth.getUser()` (never trust `getSession()` server-side). Admin routes additionally check `role`.

## Secrets & token storage

- Google refresh token (one agency-level grant) and Meta system-user token → **Supabase Vault** (`vault.create_secret`), referenced by `vault_secret_id` on the `oauth_credentials` table. Decryption only via service-role from sync code. Never in plaintext columns; never sent to the browser.
- Note: pgsodium is pending deprecation but Vault's API is unaffected (Supabase migrating internals). Fallback option if desired: AES-256-GCM app-level encryption with key in Vercel env var.
- Env vars (all marked Sensitive in Vercel): `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `META_APP_ID`, `META_APP_SECRET`, `CRON_SECRET`. Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## OAuth / connection model

**Google — one agency connection.**
1. Admin clicks "Connect Google" → standard OAuth code flow (`access_type=offline&prompt=consent&include_granted_scopes=true`) requesting scopes:
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/webmasters.readonly`
   - `https://www.googleapis.com/auth/adwords`
2. Callback exchanges code, stores refresh token in Vault, records granted scopes.
3. One refresh token mints access tokens for all three APIs. Access tokens cached in-memory per invocation only.
4. Google Ads queries add headers `developer-token` + `login-customer-id: <Broadbrand MCC id>`; client accounts must be linked under the MCC.
5. Handle `invalid_grant` → mark credential `needs_reauth`, surface in admin UI.

**Meta — system-user token.**
1. In Broadbrand Business Manager: clients share ad accounts via partner access; a system user is created with the app installed and accounts assigned ("View performance").
2. Admin pastes the generated system-user token into the admin UI once → Vault.
3. Use **expiring (60-day) system-user tokens** (Meta is pushing these): a weekly cron job re-exchanges via `GET /oauth/access_token?grant_type=fb_exchange_token&set_token_expires_in_60_days=true`, rotates the Vault secret, alerts if exchange fails.
4. All Meta calls include `appsecret_proof`.

**Source assignment.** After connecting, admin assigns sources per client from listing endpoints: GA4 `accountSummaries`, GSC `sites.list`, Ads `customers:listAccessibleCustomers` + `customer_client` GAQL, Meta `/me/adaccounts`. Stored in `data_sources` (doc 03).

## Sync pipeline

```
Vercel Cron (05:15 UTC daily)
  → GET /api/cron/sync  (validates Authorization: Bearer CRON_SECRET)
      lists active data_sources due for sync
      fan-out: fires POST /api/sync/[dataSourceId] per source (not awaited serially;
      batched with small concurrency, e.g. 5 at a time)
  → /api/sync/[dataSourceId]  (maxDuration = 800, Pro plan)
      1. load source + decrypt token
      2. create sync_runs row (status running)
      3. fetch window from platform API (nightly: last 35 days; backfill: 13 months chunked)
      4. normalize → upsert into metrics_* tables (idempotent ON CONFLICT)
      5. finalize sync_runs (rows, duration, quota telemetry, error)
```

- **Fan-out, not monolith:** one bad tenant/API can't starve the rest; each unit fits a function budget. If sync volume grows, swap dispatch for Vercel Queues (public beta) or Inngest without changing workers.
- **Idempotent upserts** keyed on `(data_source_id, metric_date, dim_key)` — safe to re-run any window.
- **Backfill** runs as chained invocations (each syncs one month then triggers the next) to stay under maxDuration.
- **Refresh button:** `POST /api/refresh` — authenticates the caller with their session and verifies membership + rate limit (`clients.last_refresh_at` > 10 min ago), then **switches to the service-role client** for all writes (updating `last_refresh_at`, inserting `sync_runs`) since client_viewers have no write policies. Fan-out sync of that client's sources, 7-day window; client polls `sync_runs` status via RLS read; UI re-fetches. Uses `after()` to return immediately.

### Scheduling & platform data-latency alignment
- Nightly at 05:15 UTC (≈07:15 SAST): GA4 daily data for "yesterday" is largely settled; GSC will still be ~2–3 days behind (expected; the rolling 35-day window re-pulls it as it finalizes).
- Weekly Meta token-refresh cron; monthly full-reconciliation sync (90-day window) to catch late restatements.

## Rate-limit & quota posture (why cached-only reads are safe)

| API | Relevant limit | Our nightly load per client |
|---|---|---|
| GA4 Data API | 200k tokens/property/day, 40k/hr; ≤10 tokens per typical request | ~5–10 reports ≈ <100 tokens |
| Search Console | 1,200 QPM/site; 25k rows/request | 2–4 queries |
| Google Ads | Basic Access 15k operations/day per dev token | 1–3 searchStream calls |
| Meta Insights | BUC: dev tier 600+400×active_ads calls/hr; standard 190k+ | 2–5 calls |

All comfortably fit even at dev/basic tiers with 50+ clients. Record `returnPropertyQuota` (GA4) and `x-business-use-case-usage` / `x-fb-ads-insights-throttle` (Meta) into `sync_runs.telemetry`; back off at 90% utilization; exponential backoff on 429/`RESOURCE_EXHAUSTED`/code 80000.

## Rendering pattern

- RSC (server component) reads Supabase with the user's session → passes serialized rows to `"use client"` chart components (charts must be client components).
- Everything under `(client)` and `(admin)` is dynamic (no caching of tenant data); Next 16 Cache Components make dynamic the default — only opt pure lookups into `use cache`.
- Suspense-stream heavy widgets; skeletons from shadcn.

## Error handling & observability

- `sync_runs` table is the audit log (per run: source, window, status, rows_upserted, error_code, error_message, telemetry jsonb, duration).
- Admin dashboard surfaces: sources with failed last run, `needs_reauth` credentials, token expiry countdown (Meta).
- Optional: Vercel log drains + a simple Slack webhook on sync failure (env-gated).
