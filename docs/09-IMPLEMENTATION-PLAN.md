# 09 — Implementation Plan (phased, for Claude Code)

Each phase ends with working, deployable software and explicit acceptance criteria. Do phases in order; within a phase, tasks are roughly sequential. Start the doc-08 starred external applications (Google Ads Basic Access, Meta Business Verification) before Phase 1.

## Phase 0 — Scaffold & foundations (≈1 session)

- `create-next-app` (Next 16, App Router, TS, Tailwind v4) + shadcn/ui init + charts.
- Supabase: local dev via CLI, first migration = full schema + RLS from doc 03 (verbatim).
- `@supabase/ssr` setup: browser client, server client, `proxy.ts` session refresh (copy official pattern; refresh cookies onto request AND response).
- Route groups: `(auth)` login/invite-accept, `(client)` dashboard shell, `(admin)` portal shell. Role-gated layouts using `getUser()` + `profiles.role`.
- Seed script: super_admin user, demo client, demo membership.
- lib structure:
  ```
  lib/supabase/{browser,server,service}.ts
  lib/integrations/{ga4,gsc,gads,meta}/  (client.ts, sync.ts, types.ts)
  lib/integrations/shared/{google-auth.ts, vault.ts, backoff.ts}
  lib/constants.ts   (API version pins: GADS_API_VERSION='v24', META_API_VERSION='v25.0')
  ```

**Accept:** deploys to Vercel; invited user can log in; RLS verified by test (user A cannot select client B rows — write an actual test hitting PostgREST with two JWTs).

## Phase 1 — Admin portal: clients & users (≈1 session)

- CRUD clients (Server Actions), archive, branding fields.
- Invite users: `auth.admin.inviteUserByEmail(email, { data: { full_name, role } })` — the doc-03 trigger creates the profile from this metadata — plus membership row. Deactivate, role change (admin update policy).
- "View as client" (admin renders any client dashboard route).

**Accept:** admin creates client, invites a viewer by email, viewer logs in and sees an empty branded dashboard.

## Phase 2 — Connections & source assignment (≈2 sessions)

- Google OAuth flow: `/api/oauth/google/start` + `/callback`; store refresh token in Vault (`oauth_credentials` row); `google-auth.ts` access-token minting with per-invocation cache; `invalid_grant` → `needs_reauth`.
- Meta token entry form (admin pastes system-user token — or interim admin user token during bootstrap, see doc 07) → validate via `/me`, store in Vault with `expires_at`.
- Meta weekly token-refresh cron route.
- Source pickers per client: GA4 `accountSummaries`, GSC `sites`, Ads `listAccessibleCustomers`+`customer_client`, Meta `/me/adaccounts` → create `data_sources` rows. Fetch + store Ads currency at assignment.
- Connection health panel (credential status, per-source last sync).

**Accept:** all four pickers list real accounts; sources assigned to demo client; tokens never appear in client bundle, logs, or non-Vault tables.

## Phase 3 — Sync pipeline (≈2–3 sessions)

- `sync_runs` machinery, `backoff.ts` (exponential, jitter), zod response schemas.
- Per-source sync modules exactly per docs 04–07 (windows, upserts, error tables).
- `/api/cron/sync` fan-out (CRON_SECRET check, concurrency ~5) + `/api/sync/[dataSourceId]` worker (`maxDuration=800`).
- Backfill: chained month-chunk invocations; Meta backfill via async report runs.
- `/api/refresh`: membership check via session, then service-role for writes (see doc 02); 10-min rate limit on `clients.last_refresh_at`, 7-day window fan-out via `after()`, status polled from `sync_runs` (RLS read).
- Monthly reconcile cron (90-day window).

**Accept:** nightly cron syncs demo client end-to-end; re-running any window changes no row counts (idempotency); killing one source's API key fails that source's run only; telemetry recorded.

## Phase 4 — Client dashboard (≈2–3 sessions)

- Date-range picker (presets + custom + previous-period comparison) in URL search params.
- Widgets (RSC data fetch → client chart components, shadcn charts):
  - Overview: combined spend, sessions, key events, per-source KPI cards with % vs previous period
  - Per-source sections per PRD F4 (time series, tables, donuts)
  - Empty states for unconnected sources; "Data updated X ago" from `last_synced_at`
- Refresh button: POST, optimistic spinner, poll `sync_runs`, re-fetch via `router.refresh()`.
- Dashboard config applied: sections/widgets toggled + ordered from `dashboard_configs.config`; admin annotation note rendered.
- Print stylesheet (clients will print/PDF from browser).

**Accept:** dashboard first paint <1s from cache; comparison math correct (spot-check against Ads UI); Refresh updates data and timestamp; config changes reflect instantly.

## Phase 5 — Admin dashboard editor (≈1 session)

- Structured settings form per client (no drag-drop): enable/disable sections, reorder (up/down), default date range, primary Meta action type, annotation notes.
- Config zod-validated; preview via "View as client".

**Accept:** admin hides a section and reorders another; client view reflects it.

## Phase 6 — Hardening & launch (≈1–2 sessions)

- Verification pass: cross-check one month of synced numbers per source against each platform's native UI (small deltas expected: GSC anonymized queries, Meta attribution timing — document them).
- Alerting: sync failure + `needs_reauth` + Meta token <14 days → email/Slack webhook.
- Security review: run RLS test suite; confirm service-role key server-only; `Sensitive` env vars; cron auth; no token in logs.
- Custom domain (e.g. analytics.broadbrand.co.za), Supabase redirect URLs, invite email template branding.
- Load sanity check: seed 50 fake clients × 13 months, verify dashboard query times + nightly cron duration.

**Accept:** production domain live, real client onboarded per doc-08 checklist, numbers verified against platform UIs.

## v2 backlog (do not build now)
Scheduled PDF/email reports · additional sources (LinkedIn/TikTok) · client-facing CSV export per widget · anomaly alerts ("spend spike") · Vercel Queues migration if fan-out outgrows plain dispatch · cross-client admin rollup view.
