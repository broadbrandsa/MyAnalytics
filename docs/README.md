# Broadbrand Client Analytics Dashboard — Spec Pack

Implementation documentation for a multi-tenant digital analytics dashboard for Broadbrand clients. Pulls metrics from Meta Ads, Google Ads, Google Analytics 4, and Search Console into read-only client dashboards (Looker Studio-style, without client editing).

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Vault) · Vercel (hosting, cron) · shadcn/ui + Recharts · Tailwind v4

## Documents

| Doc | Purpose |
|---|---|
| [01-PRD.md](01-PRD.md) | Product requirements: users, features, dashboard views, non-goals |
| [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | System architecture, auth model, sync pipeline, refresh flow |
| [03-DATABASE-SCHEMA.md](03-DATABASE-SCHEMA.md) | Full Postgres schema, RLS policies, indexes |
| [04-INTEGRATION-GA4.md](04-INTEGRATION-GA4.md) | Google Analytics 4 Data API integration |
| [05-INTEGRATION-SEARCH-CONSOLE.md](05-INTEGRATION-SEARCH-CONSOLE.md) | Search Console API integration |
| [06-INTEGRATION-GOOGLE-ADS.md](06-INTEGRATION-GOOGLE-ADS.md) | Google Ads API integration |
| [07-INTEGRATION-META-ADS.md](07-INTEGRATION-META-ADS.md) | Meta Marketing API integration |
| [08-OAUTH-SETUP-RUNBOOK.md](08-OAUTH-SETUP-RUNBOOK.md) | One-time setup: Google Cloud project, Meta app, env vars |
| [09-IMPLEMENTATION-PLAN.md](09-IMPLEMENTATION-PLAN.md) | Phased build plan with acceptance criteria |
| [CLAUDE.md](CLAUDE.md) | Copy to repo root — conventions and guardrails for Claude Code |

## Key decisions (locked)

1. **Client access:** login per client (Supabase Auth, invite-only). Clients see only their own dashboards.
2. **OAuth model:** Broadbrand admins connect all accounts. Google via one agency OAuth (MCC for Ads); Meta via a system-user token under Broadbrand's Business Manager with client accounts shared as partner. Clients never see a connect flow.
3. **Data refresh:** metrics cached in Supabase, nightly cron sync + on-demand Refresh button (rate-limited). Dashboards read only from the DB — never live from platform APIs.
4. **Dashboards:** admins configure layout/widgets per client; clients get a read-only live view.

## How to use with Claude Code

In a new repo: copy this folder in as `docs/`, then move `CLAUDE.md` from `docs/` to the repo root (it references the specs at `docs/`). Work through `docs/09-IMPLEMENTATION-PLAN.md` phase by phase. Each integration doc is self-contained for its sync module.

*Research verified against official docs, July 2026. Re-check Google Ads API sunset dates and Meta API version expiry before launch.*
