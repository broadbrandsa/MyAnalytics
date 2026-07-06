-- ============================================================================
-- 20260706113100_vault_rpc.sql
-- Vault access via public SECURITY DEFINER wrappers.
--
-- The JS client reaches the DB through PostgREST, which only exposes `public`
-- (+ graphql_public) — the `vault` schema is not callable directly. These
-- wrappers run as the definer (which can access Vault) and are execute-granted
-- to service_role ONLY, so tokens can be stored/rotated/read from server code
-- without exposing the vault schema over the API.
-- ============================================================================

create or replace function public.create_vault_secret(
  secret text,
  name text,
  description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_id uuid;
begin
  select vault.create_secret(secret, name, description) into new_id;
  return new_id;
end $$;

create or replace function public.read_vault_secret(secret_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where id = secret_id;
$$;

create or replace function public.update_vault_secret(secret_id uuid, secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform vault.update_secret(secret_id, secret);
end $$;

-- Lock down: service-role only (these handle plaintext secrets).
revoke all on function public.create_vault_secret(text, text, text) from public, anon, authenticated;
revoke all on function public.read_vault_secret(uuid) from public, anon, authenticated;
revoke all on function public.update_vault_secret(uuid, text) from public, anon, authenticated;

grant execute on function public.create_vault_secret(text, text, text) to service_role;
grant execute on function public.read_vault_secret(uuid) to service_role;
grant execute on function public.update_vault_secret(uuid, text) to service_role;
