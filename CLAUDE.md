# CLAUDE.md — Broadbrand Analytics Dashboard

Multi-tenant client analytics portal: Meta Ads, Google Ads, GA4, Search Console → cached in Supabase → read-only client dashboards. Full specs in `docs/` (numbered 01–09). Read `docs/09-IMPLEMENTATION-PLAN.md` for the current phase; integration details live in `docs/04`–`07` and are authoritative.

## Stack
Next.js 16 App Router (TS, Turbopack) · React 19 · Supabase (`@supabase/ssr`) · Vercel Pro (crons, maxDuration 800) · Tailwind v4 · shadcn/ui + Recharts · zod for all external API parsing.

## Hard rules

1. **Dashboards never call platform APIs.** All reads come from `metrics_*` tables. Platform APIs are touched only in `lib/integrations/*/sync.ts`, invoked by cron/refresh routes.
2. **Tokens live in Supabase Vault only.** Reference by `vault_secret_id`; decrypt only via service-role in server code. Never log tokens, never return them from any route, never store plaintext in ordinary columns.
3. **Service-role key is server-only** (`lib/supabase/service.ts`). Never import into anything reachable from a client component. Client reads use the user session + RLS. Exception pattern: `/api/refresh` authenticates with the session, then performs its writes via service-role (client_viewers have zero write policies by design).
4. **Auth checks use `supabase.auth.getUser()`**, never `getSession()`, in server code. Session refresh lives in `proxy.ts` (Next 16 rename of middleware) — cookies must be set on both request and response.
5. **RLS on every table.** New tables get policies in the same migration. Sync writes bypass RLS via service role; nothing else does.
6. **Idempotent upserts.** Every metrics write is `on conflict ... do update`. Re-running any sync window must not change row counts.
7. **API versions are pinned in `lib/constants.ts`** (`GADS_API_VERSION = 'v24'`, `META_API_VERSION = 'v25.0'`). Never hardcode versions elsewhere.
8. **Cron routes validate `Authorization: Bearer ${CRON_SECRET}`** before doing anything.
9. **Money:** Google Ads `cost_micros / 1e6` at write time; store numeric. Currency per source (`data_sources.config.currency`); don't sum across currencies.
10. **All external API responses parsed with zod** — platform APIs return strings for numbers (GA4) and shifting shapes; fail loudly with the raw payload logged (minus tokens).

## Conventions

- Server Actions for admin mutations; Route Handlers only for cron, sync workers, OAuth callbacks, refresh endpoint.
- Charts are `"use client"` components receiving serialized rows from RSC parents.
- Every sync execution creates/finalizes a `sync_runs` row, including failures.
- Errors from platform APIs map to the action tables in docs 04–07 (e.g. Meta code 80000 → defer; `invalid_grant` → credential `needs_reauth`).
- Backoff: `lib/integrations/shared/backoff.ts`, exponential + jitter, max 3 retries, then record and defer to next run — never busy-wait.
- Migrations: `supabase/migrations/`, additive; never edit an applied migration.
- Dates: platform data stored at daily grain by `metric_date` in the source's reporting timezone semantics (GA4 property tz, Meta ad-account tz); dashboard treats them at face value.

## Testing priorities
1. RLS isolation (two users, two clients, cross-access must fail) — this is the one non-negotiable test suite.
2. Sync idempotency (run window twice, assert identical state).
3. Response-parser fixtures per platform (store real anonymized JSON fixtures).

## Env vars
See `docs/08-OAUTH-SETUP-RUNBOOK.md` §E. `NEXT_PUBLIC_*` = Supabase URL + anon key only. Everything else is a server secret.
