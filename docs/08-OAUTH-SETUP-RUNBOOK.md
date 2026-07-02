# 08 — OAuth & Platform Setup Runbook (one-time, manual)

Human tasks that must happen outside the codebase. Do the starred items in week 1 — they have external review lead times.

## A. Google Cloud project

1. Create project `broadbrand-analytics` at console.cloud.google.com (under Broadbrand's org if one exists).
2. Enable APIs: **Google Analytics Data API**, **Google Analytics Admin API**, **Google Search Console API**, **Google Ads API**.
3. OAuth consent screen:
   - User type: **External** (unless all agency Google users are in one Workspace org — then Internal, which skips verification and the 7-day token trap entirely).
   - App name "Broadbrand Analytics", support email, privacy policy URL (must exist on broadbrand domain), authorized domain.
   - Scopes: `analytics.readonly`, `webmasters.readonly`, `adwords` (all "sensitive" class — verification needed, but NOT the restricted-scope security audit).
   - ★ **Publish to "In production" immediately.** In "Testing" mode refresh tokens expire after 7 days — the most common failure mode for this kind of app. Submit brand verification when prompted; while unverified you'll see a warning screen and 100-user cap, which is fine since only Broadbrand admins ever authorize.
4. Credentials → OAuth client ID (Web application):
   - Redirect URIs: `https://<prod-domain>/api/oauth/google/callback`, `http://localhost:3000/api/oauth/google/callback`
   - → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. OAuth flow params (in code): `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`.
6. Gotchas: Google caps 50 live refresh tokens per user per client (store newest only); tokens die after 6 months unused (nightly cron prevents this); handle `invalid_grant` as `needs_reauth`.

## B. Google Ads

1. ★ In the **Broadbrand MCC** → Tools → API Center: create **developer token** → `GOOGLE_ADS_DEVELOPER_TOKEN`. It starts at Test Access.
2. ★ **Apply for Basic Access** (form in API Center): describe an internal client-reporting dashboard (read-only reporting is a standard approved use; RMF doesn't apply to pure reporting tools), link privacy policy. Lead time: days to weeks. 15k operations/day is ample.
3. Set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = MCC customer ID (digits only).
4. Ensure every client ad account is **linked under the MCC** (send link request from MCC; client accepts). Only linked accounts are queryable with the agency OAuth token.
5. While waiting for Basic Access: create a test MCC + test accounts to develop against.

## C. Google account access for GA4 / Search Console

The Google identity that performs the agency OAuth (e.g. analytics@broadbrand) must have:
- **Viewer+** on each client GA4 property (client adds the email in GA Admin → Property access)
- **Full or Restricted** user on each client Search Console property

Make this part of the client-onboarding checklist.

## D. Meta

1. ★ developers.facebook.com → Create App → type **Business** → add Marketing API product. → `META_APP_ID` / `META_APP_SECRET`.
2. ★ **Business Verification** for Broadbrand's Business Manager (Business Settings → Security Center): legal docs, takes days-to-weeks.
3. Client sharing: each client shares their ad account with Broadbrand BM as **Partner** (Business Settings → Ad Accounts → Assign Partner, Broadbrand's BM ID, "View performance" level) — most already do this if Broadbrand runs their ads.
4. System user: Business Settings → Users → System Users → Add (name `analytics-dashboard`, role Employee is enough for read).
   - Assign each client ad account to it (View performance).
   - Install the app on it and **Generate Token**: scope `ads_read,business_management`, 60-day expiry. Paste into admin UI → Vault.
   - Note: app installation on a system user requires the upper **Marketing API Access Tier** ("Full Access"). Bootstrap: develop with an admin's user token (dev tier), accumulate ≥500 calls/15 days with <15% errors, then request the tier from App Dashboard (no screencast required since May 2026), then create the system-user token.
5. App can remain in dev/standard mode indefinitely — no App Review needed because only role-holding users (Broadbrand staff/system user) ever use it. Complete the annual Data Use Checkup when prompted.

## E. Vercel + Supabase

1. Supabase project (region: closest to ZA users — `eu-west` typically): note URL, anon key, service-role key. Disable public email signups (Auth → Providers). Set Site URL + redirect URLs for invite emails.
2. Vercel project (Pro plan — needed for >daily cron precision and 800s maxDuration): link repo, set env vars (mark secrets **Sensitive**):
   ```
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
   GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_LOGIN_CUSTOMER_ID,
   META_APP_ID, META_APP_SECRET, CRON_SECRET (random 32+ chars)
   ```
3. Crons (`vercel.json` — UTC only):
   ```json
   {
     "crons": [
       { "path": "/api/cron/sync", "schedule": "15 5 * * *" },
       { "path": "/api/cron/meta-token-refresh", "schedule": "0 6 * * 1" },
       { "path": "/api/cron/reconcile", "schedule": "30 6 1 * *" }
     ]
   }
   ```
   Cron endpoints must check `Authorization: Bearer ${CRON_SECRET}` (Vercel sends it automatically when the env var exists).

## Client onboarding checklist (repeat per client)

1. Client adds agency Google user to GA4 property (Viewer) and Search Console (Restricted).
2. Client's Google Ads account linked under Broadbrand MCC.
3. Client shares Meta ad account to Broadbrand BM (partner, View performance); admin assigns it to the system user.
4. Admin: create client org → assign 4 sources from pickers → backfill runs → invite client users → verify dashboard.
