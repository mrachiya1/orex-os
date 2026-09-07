-- Phase 017: Clients Intelligence V1 -- client credential METADATA ONLY.
--
-- No secret-value column exists on this table, period -- mirrors
-- user_connections (0030)'s deliberate "architecture placeholder, no
-- tokens yet" precedent. secret_reference is an opaque pointer, always
-- null until a real encrypted vault/OAuth architecture is approved. Gated
-- on its own two permission keys (added in 0044), never implied by the
-- broad clients.read/.update grant every other client sub-resource uses.

create table if not exists client_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  company_id uuid not null references companies(id) on delete restrict,
  label text not null,
  credential_type text not null check (credential_type in (
    'website_login', 'hosting', 'social_media', 'server', 'dns', 'email', 'other'
  )),
  provider text,
  username_hint text,
  secret_reference text,
  last_updated_at timestamptz,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_credentials_client_id_idx on client_credentials (client_id);
create index if not exists client_credentials_company_id_idx on client_credentials (company_id);

alter table client_credentials enable row level security;

create policy client_credentials_select
  on client_credentials for select
  to authenticated
  using (public.has_company_permission(company_id, 'client_credentials.read_metadata'));

create policy client_credentials_insert
  on client_credentials for insert
  to authenticated
  with check (public.has_company_permission(company_id, 'client_credentials.manage'));

create policy client_credentials_update
  on client_credentials for update
  to authenticated
  using (public.has_company_permission(company_id, 'client_credentials.manage'))
  with check (public.has_company_permission(company_id, 'client_credentials.manage'));
