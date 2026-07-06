-- ============================================================================
-- 20260706084741_access_codes.sql
-- Client access via a short numeric code (no per-user login for clients).
-- Each client gets a unique code; entering it grants a signed cookie scoped to
-- that client. Admins still authenticate with Supabase Auth.
-- ============================================================================

-- One code per client (nullable until set). Unique across all clients so a code
-- maps to exactly one dashboard.
alter table clients add column access_code text;

create unique index clients_access_code_key
  on clients (access_code)
  where access_code is not null;

-- Per-IP rate limiting for code entry (brute-force mitigation). Written only by
-- the service role from the code-entry action; RLS on with NO policies means
-- authenticated/anon roles cannot read or write it.
create table access_attempts (
  ip text primary key,
  count int not null default 0,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table access_attempts enable row level security;
-- (intentionally no policies: service-role only)
