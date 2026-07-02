# Broadbrand Analytics

Multi-tenant, white-label client analytics portal. Pulls Meta Ads, Google Ads,
GA4, and Search Console metrics into read-only client dashboards (Looker
Studio-style, without client editing). Data is cached in Supabase and dashboards
**never** call platform APIs in the request path.

Full specs live in [`docs/`](docs/) (numbered 01–09). Start with
[`docs/09-IMPLEMENTATION-PLAN.md`](docs/09-IMPLEMENTATION-PLAN.md). Conventions
and guardrails are in [`CLAUDE.md`](CLAUDE.md).

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Supabase
(Postgres/Auth/Vault, `@supabase/ssr`) · Vercel Pro (crons) · Tailwind v4 ·
shadcn/ui + Recharts · zod.

## Local development

Prerequisites: Node 22+, Docker (for local Supabase), the Supabase CLI.

```bash
# 1. Install deps
npm install

# 2. Start local Supabase (Postgres, Auth, Vault) + apply migrations
supabase start          # first run pulls Docker images
supabase db reset       # applies supabase/migrations/* (schema + RLS)

# 3. Configure env — copy the printed values from `supabase status`
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL      -> API URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY -> anon key
#   SUPABASE_SERVICE_ROLE_KEY     -> service_role key

# 4. Seed a super_admin + demo client + viewer
npm run seed

# 5. Run
npm run dev             # http://localhost:3000
```

Seeded logins (local only):

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@broadbrand.local` | `password123` |
| Client viewer | `viewer@democlient.local` | `password123` |

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run test` | Vitest (RLS isolation, sync idempotency) |
| `npm run db:reset` | Reset local DB + re-apply migrations |
| `npm run seed` | Seed local admin/client/viewer |

## Testing priorities (see `CLAUDE.md`)

1. **RLS isolation** — two users, two clients, cross-access must fail
   (`tests/rls.test.ts`). Non-negotiable.
2. Sync idempotency — re-running a window changes no row counts (Phase 3).
3. Response-parser fixtures per platform (Phase 3).

## Project status

Phase 0 (scaffold & foundations) complete. See
[`docs/09-IMPLEMENTATION-PLAN.md`](docs/09-IMPLEMENTATION-PLAN.md) for the phased
build plan.
