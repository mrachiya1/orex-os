-- Phase 001: companies
-- Seeds Orextic and Orex Studios under Orex Group.
-- The select policy here is a temporary permissive one; it is replaced in
-- 0006_rls_helper_functions.sql once membership tables and the permission
-- helper function exist, so that only actual members (or org-level grant
-- holders) can read a company's row.

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  name text not null,
  slug text not null,
  accent_color_key text not null default 'neutral',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, slug)
);

create index if not exists companies_organisation_id_idx on companies (organisation_id);

alter table companies enable row level security;

create policy companies_select_temp_authenticated
  on companies for select
  to authenticated
  using (true);

insert into companies (organisation_id, name, slug, accent_color_key)
select id, 'Orextic', 'orextic', 'orextic' from organisations where slug = 'orex-group'
on conflict (organisation_id, slug) do nothing;

insert into companies (organisation_id, name, slug, accent_color_key)
select id, 'Orex Studios', 'orex-studios', 'orex-studios' from organisations where slug = 'orex-group'
on conflict (organisation_id, slug) do nothing;
