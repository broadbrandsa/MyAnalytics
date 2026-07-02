-- ============================================================================
-- 20260702114521_init_schema_rls.sql
-- Broadbrand Analytics — full schema + RLS (docs/03-DATABASE-SCHEMA.md, verbatim)
-- Additive migration. NEVER edit once applied; add follow-up migrations instead.
-- ============================================================================

create schema if not exists private;   -- helpers/triggers, not exposed via PostgREST

-- roles enum
create type app_role as enum ('super_admin','admin','client_viewer');
-- source is deliberately text+check, not an enum: PRD requires new sources addable
-- without type migrations (to add a source later: drop+recreate the check constraint)
create domain source_type as text
  check (value in ('ga4','gsc','google_ads','meta_ads'));
create type sync_status as enum ('queued','running','success','error');
create type credential_status as enum ('active','needs_reauth','revoked');

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  brand_color text,
  timezone text not null default 'Africa/Johannesburg',
  currency text not null default 'ZAR',
  last_refresh_at timestamptz,          -- Refresh-button rate limiting
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role app_role not null default 'client_viewer',
  created_at timestamptz not null default now()
);

-- auto-create a profile on signup/invite (role/full_name passed via invite metadata)
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'client_viewer')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create table memberships (
  client_id uuid not null references clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (client_id, user_id)
);
create index on memberships (user_id);

-- one row per platform credential (Google agency grant, Meta system-user token)
create table oauth_credentials (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google','meta')),
  label text not null,                       -- e.g. 'Broadbrand agency Google', 'BB BM system user'
  vault_secret_id uuid not null,             -- -> vault.secrets (refresh token / system-user token)
  scopes text[] not null default '{}',
  status credential_status not null default 'active',
  expires_at timestamptz,                    -- Meta 60-day token expiry; null for Google refresh tokens
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now()
);

-- a platform account/property assigned to a client
create table data_sources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  credential_id uuid not null references oauth_credentials(id),
  source source_type not null,
  external_id text not null,       -- GA4: 'properties/123', GSC: 'sc-domain:x.com' or URL,
                                   -- Ads: customer id '1234567890', Meta: 'act_123'
  display_name text not null,
  config jsonb not null default '{}',   -- per-source extras (e.g. Ads login_customer_id override)
  is_active boolean not null default true,
  backfill_completed_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, source, external_id)
);
create index on data_sources (client_id);
create index on data_sources (is_active, last_synced_at);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references data_sources(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,  -- denormalized: clients poll refresh status
  trigger text not null check (trigger in ('cron','refresh','backfill','manual')),
  window_start date not null,
  window_end date not null,
  status sync_status not null default 'queued',
  rows_upserted int,
  error_code text,
  error_message text,
  telemetry jsonb,                 -- quota headers, token costs
  started_at timestamptz default now(),
  finished_at timestamptz
);
create index on sync_runs (data_source_id, started_at desc);
create index on sync_runs (client_id, started_at desc);

create table dashboard_configs (
  client_id uuid primary key references clients(id) on delete cascade,
  config jsonb not null default '{}',   -- widget layout: sections[], each {source, widgets[], order, enabled}
  default_date_range text not null default 'last_28_days',
  notes text,                            -- admin annotation shown on dashboard
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Metrics tables (daily grain, typed columns)
-- All money in micros converted at write time to numeric.
-- ---------------------------------------------------------------------------

-- GA4: one row per property/date/channel (channel = sessionDefaultChannelGroup; 'TOTAL' row too)
create table metrics_ga4_daily (
  data_source_id uuid not null references data_sources(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,  -- denormalized for RLS + query speed
  metric_date date not null,
  channel text not null default 'TOTAL',
  sessions int not null default 0,
  total_users int not null default 0,
  new_users int not null default 0,
  engaged_sessions int not null default 0,
  engagement_rate numeric(8,6),
  key_events numeric(14,2) not null default 0,   -- GA4 renamed 'conversions' -> keyEvents
  total_revenue numeric(14,2) not null default 0,
  device_split jsonb,               -- {desktop:{sessions},mobile:{...},tablet:{...}}; populated on channel='TOTAL' rows only
  synced_at timestamptz not null default now(),
  primary key (data_source_id, metric_date, channel)
);

create table metrics_ga4_pages (   -- top landing pages, per date
  data_source_id uuid not null references data_sources(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  metric_date date not null,
  landing_page text not null,
  sessions int not null default 0,
  key_events numeric(14,2) not null default 0,
  primary key (data_source_id, metric_date, landing_page)
);

-- GSC: totals per date (+device split in jsonb), plus query/page rollups
create table metrics_gsc_daily (
  data_source_id uuid not null references data_sources(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  metric_date date not null,
  clicks int not null default 0,
  impressions int not null default 0,
  ctr numeric(8,6),
  position numeric(8,2),
  device_split jsonb,               -- {desktop:{...},mobile:{...},tablet:{...}}
  is_final boolean not null default false,   -- GSC finalizes ~3 days later
  synced_at timestamptz not null default now(),
  primary key (data_source_id, metric_date)
);

create table metrics_gsc_queries (  -- weekly grain to control row count
  data_source_id uuid not null references data_sources(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  week_start date not null,
  query text not null,
  clicks int not null default 0,
  impressions int not null default 0,
  position numeric(8,2),
  primary key (data_source_id, week_start, query)
);

create table metrics_gsc_pages (
  data_source_id uuid not null references data_sources(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  week_start date not null,
  page text not null,
  clicks int not null default 0,
  impressions int not null default 0,
  position numeric(8,2),
  primary key (data_source_id, week_start, page)
);

-- Google Ads: per campaign per date ('TOTAL' campaign row for account-level)
create table metrics_gads_daily (
  data_source_id uuid not null references data_sources(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  metric_date date not null,
  campaign_id text not null default 'TOTAL',
  campaign_name text,
  impressions bigint not null default 0,
  clicks int not null default 0,
  cost numeric(14,2) not null default 0,          -- cost_micros / 1e6
  conversions numeric(14,2) not null default 0,
  conversions_value numeric(14,2) not null default 0,
  synced_at timestamptz not null default now(),
  primary key (data_source_id, metric_date, campaign_id)
);

-- Meta: per campaign per date ('TOTAL' row at account level)
create table metrics_meta_daily (
  data_source_id uuid not null references data_sources(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  metric_date date not null,
  campaign_id text not null default 'TOTAL',
  campaign_name text,
  impressions bigint not null default 0,
  reach bigint,                     -- only reliable at TOTAL level / recent windows
  clicks int not null default 0,
  spend numeric(14,2) not null default 0,
  cpm numeric(10,4),
  cpc numeric(10,4),
  ctr numeric(8,6),
  actions jsonb,                    -- [{action_type, value}] raw
  conversions numeric(14,2) not null default 0,  -- extracted primary action (configurable per source)
  synced_at timestamptz not null default now(),
  primary key (data_source_id, metric_date, campaign_id)
);

-- Indexes for dashboard range scans
create index on metrics_ga4_daily (client_id, metric_date);
create index on metrics_ga4_pages (client_id, metric_date);
create index on metrics_gsc_daily (client_id, metric_date);
create index on metrics_gsc_queries (client_id, week_start);
create index on metrics_gsc_pages (client_id, week_start);
create index on metrics_gads_daily (client_id, metric_date);
create index on metrics_meta_daily (client_id, metric_date);

-- ---------------------------------------------------------------------------
-- RLS (complete — apply verbatim)
-- ---------------------------------------------------------------------------

-- helpers: security definer avoids recursive RLS; (select auth.uid()) enables initPlan caching
create function private.user_client_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select client_id from public.memberships where user_id = (select auth.uid()) $$;

create function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles
       where user_id = (select auth.uid()) and role in ('admin','super_admin')) $$;

-- enable RLS on EVERY table (mandatory — public schema is exposed via PostgREST)
alter table clients             enable row level security;
alter table profiles            enable row level security;
alter table memberships         enable row level security;
alter table oauth_credentials   enable row level security;
alter table data_sources        enable row level security;
alter table sync_runs           enable row level security;
alter table dashboard_configs   enable row level security;
alter table metrics_ga4_daily   enable row level security;
alter table metrics_ga4_pages   enable row level security;
alter table metrics_gsc_daily   enable row level security;
alter table metrics_gsc_queries enable row level security;
alter table metrics_gsc_pages   enable row level security;
alter table metrics_gads_daily  enable row level security;
alter table metrics_meta_daily  enable row level security;

-- clients: members read theirs; admins read all; only admins write
create policy client_member_read on clients for select to authenticated
  using (id in (select private.user_client_ids()) or (select private.is_admin()));
create policy client_admin_write on clients for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- profiles: self + admin read; admin write (inserts happen via trigger/service role)
create policy profile_read on profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy profile_admin_write on profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- memberships
create policy membership_self_read on memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy membership_admin_write on memberships for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- oauth_credentials: ADMIN ONLY (vault_secret_id must never reach the browser regardless)
create policy cred_admin_only on oauth_credentials for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- member-read + admin-write pair, one per tenant table:
do $$
declare t text;
begin
  foreach t in array array[
    'data_sources','sync_runs','dashboard_configs',
    'metrics_ga4_daily','metrics_ga4_pages',
    'metrics_gsc_daily','metrics_gsc_queries','metrics_gsc_pages',
    'metrics_gads_daily','metrics_meta_daily'
  ] loop
    execute format($f$
      create policy %1$I_member_read on %1$I for select to authenticated
        using (client_id in (select private.user_client_ids()) or (select private.is_admin()));
      create policy %1$I_admin_write on %1$I for all to authenticated
        using ((select private.is_admin())) with check ((select private.is_admin()));
    $f$, t);
  end loop;
end $$;
