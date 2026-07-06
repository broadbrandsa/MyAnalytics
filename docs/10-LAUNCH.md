# 10 — Launch & Hardening Checklist

Operational steps to take the app live. Code for Phases 0–5 is complete; this
covers Phase 6 (hardening) and deployment.

## Security review (enforced in code)

- **RLS on every table**, verified by `tests/rls.test.ts` (two clients, two
  users, cross-access fails; client_viewers cannot write; `oauth_credentials`
  invisible to them). Non-negotiable suite — keep it green.
- **Tokens only in Vault** — `oauth_credentials.vault_secret_id` references
  `vault.secrets`; secrets are read/rotated only via service-role in
  `lib/integrations/shared/{vault,credentials-store,google-auth}.ts`. No token
  is logged (only `error.message` / status strings) or returned from any route.
- **Service-role key server-only** — `lib/supabase/service.ts` imports
  `server-only`; the build fails if it's pulled into a client bundle.
- **Client access** — 4-digit code → HMAC-signed httpOnly cookie
  (`ACCESS_COOKIE_SECRET`); per-IP rate limit (`access_attempts`). Forged/stale
  cookies rejected (`tests/access.test.ts`). Consider 6 digits for production
  (`CODE_LENGTH` in `lib/access/codes.ts`).
- **Cron/worker routes** validate `Authorization: Bearer ${CRON_SECRET}`
  (`tests/cron-auth.test.ts`); `/api/refresh` authorizes via access cookie or
  session; API routes return 401 (not a redirect) when unauthenticated.
- **Alerting** — set `ALERT_WEBHOOK_URL` (Slack-compatible) to receive
  needs_reauth / source-deactivated / Meta-token-refresh-failure alerts.

## Pre-launch operational checks (need live data)

- [ ] **Numbers verification** — after the first real sync, cross-check one
      month per source against each platform's native UI. Expected small deltas:
      GSC anonymized queries (query sums < totals), Meta attribution timing,
      GA4 (thresholding). Document any deltas for the client.
- [ ] **Load sanity** — optional: seed ~50 clients × 13 months and confirm
      dashboard query times + nightly cron duration stay within budget. Revisit
      partitioning past ~20M metric rows (doc 03).
- [ ] **Meta** — deferred until the system-user token is available (doc 07).

## Deploy: Supabase (production)

1. Create a cloud Supabase project (region close to ZA, e.g. `eu-west`).
   Disable public email signups (Auth → Providers).
2. Link + push migrations:
   ```bash
   supabase link --project-ref <ref>
   supabase db push          # applies supabase/migrations/*
   ```
3. Set Auth → URL config: Site URL = production domain; add
   `https://<domain>/auth/confirm` to redirect allow-list (mirrors
   `supabase/config.toml`). Upload the invite email template (`supabase/templates/invite.html`).
4. Seed a super_admin (run `npm run seed` against the prod project, or create the
   admin user via the Supabase dashboard with `role: super_admin` in user
   metadata so the trigger sets the profile).

## Deploy: Vercel

1. Import the GitHub repo (`broadbrandsa/MyAnalytics`) as a Vercel project
   (**Pro plan** — needed for 800s `maxDuration` + cron precision). Root
   directory = repo root (the Next app is at the root).
2. Env vars (mark all except `NEXT_PUBLIC_*` as **Sensitive**):
   ```
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY, ACCESS_COOKIE_SECRET, CRON_SECRET,
   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
   GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_LOGIN_CUSTOMER_ID,
   META_APP_ID, META_APP_SECRET,           # when Meta is ready
   NEXT_PUBLIC_SITE_URL=https://<domain>,
   ALERT_WEBHOOK_URL                        # optional
   ```
   Generate fresh 32+ char random values for `ACCESS_COOKIE_SECRET` and
   `CRON_SECRET` (do NOT reuse the local dev values).
3. Crons are declared in `vercel.json` (nightly sync 05:15 UTC, Meta token
   refresh Mondays 06:00, monthly reconcile). Vercel sends the `CRON_SECRET`
   bearer automatically.
4. Custom domain (e.g. `analytics.broadbrand.co.za`). Then update:
   - Google Cloud OAuth client redirect URI → `https://<domain>/api/oauth/google/callback`
   - `NEXT_PUBLIC_SITE_URL` + Supabase Site URL/redirects to the domain.

## Post-deploy smoke test

1. Admin logs in at `/login` → `/admin`.
2. Connect Google (Connections → Connect Google) → complete consent.
3. Create a client, assign GA4/GSC/Ads sources (backfill kicks off).
4. Set the client's access code; open `/` in a fresh browser, enter the code →
   dashboard renders.
5. Trigger `/api/cron/sync` once (or wait for nightly); confirm `sync_runs`
   success and data appears.
