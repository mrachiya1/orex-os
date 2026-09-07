-- Phase 017: Clients Intelligence V1 -- core tables.
--
-- clients, client_contacts, client_contact_private, client_brands.
-- Reuses the already-seeded (Phase 001, dormant until now) clients.read/
-- create/update/delete permissions -- see prompts/017-clients-intelligence-
-- v1.md section 10. client_contact_private is a separate, stricter table
-- (founder decision 2) mirroring user_private_profiles' shape but scoped by
-- explicit company permission (client_contacts.read_private/manage_private,
-- added in 0044) rather than self-only, since a client contact has no auth
-- identity of its own.
--
-- RLS follows the has_company_permission/has_org_permission branch pattern
-- from 0006/0019/0013. Resource-scoped Contractor narrowing (has_client_
-- access) is added in 0040, once projects.client_id exists to narrow
-- against -- see that migration's header comment.

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  name text not null,
  legal_name text,
  status text not null default 'lead'
    check (status in ('lead', 'negotiating', 'active', 'paused', 'inactive', 'completed', 'lost')),
  relationship_stage text not null default 'new'
    check (relationship_stage in ('new', 'developing', 'established', 'long_term', 'at_risk', 'dormant')),
  website text,
  industry text,
  country text,
  timezone text,
  source text,
  how_we_met text,
  client_since date,
  last_interaction_at timestamptz,
  notes_summary text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists clients_company_id_idx on clients (company_id);
create index if not exists clients_organisation_id_idx on clients (organisation_id);
create index if not exists clients_status_idx on clients (company_id, status);
create index if not exists clients_last_interaction_at_idx on clients (company_id, last_interaction_at);

create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,
  first_name text not null,
  last_name text,
  preferred_name text,
  job_title text,
  business_email text,
  business_phone text,
  timezone text,
  country text,
  is_primary_contact boolean not null default false,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_contacts_client_id_idx on client_contacts (client_id);
create index if not exists client_contacts_company_id_idx on client_contacts (company_id);

-- Sensitive personal fields only. No credentials/passwords here (those live
-- in client_credentials, metadata-only -- see 0043). 1:1 with
-- client_contacts; deleted automatically when the contact is (cascade).
create table if not exists client_contact_private (
  contact_id uuid primary key references client_contacts(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,
  birthday date,
  personal_email text,
  personal_phone text,
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_contact_private_company_id_idx on client_contact_private (company_id);

create table if not exists client_brands (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,
  name text not null,
  website text,
  category text,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_brands_client_id_idx on client_brands (client_id);
create index if not exists client_brands_company_id_idx on client_brands (company_id);

alter table clients enable row level security;
alter table client_contacts enable row level security;
alter table client_contact_private enable row level security;
alter table client_brands enable row level security;

-- clients: company-scoped only (a client relationship always belongs to
-- exactly one company; there is no group/org-level client concept), plus
-- an org-wide grant branch mirroring every other company-scoped table.
-- Replaced in 0040 to add has_client_access()'s resource-scoping once
-- projects.client_id exists to narrow against.
create policy clients_select
  on clients for select
  to authenticated
  using (
    public.has_company_permission(company_id, 'clients.read')
    or public.has_org_permission(organisation_id, 'clients.read')
  );

create policy clients_insert
  on clients for insert
  to authenticated
  with check (
    public.has_company_permission(company_id, 'clients.create')
    or public.has_org_permission(organisation_id, 'clients.create')
  );

create policy clients_update
  on clients for update
  to authenticated
  using (
    public.has_company_permission(company_id, 'clients.update')
    or public.has_org_permission(organisation_id, 'clients.update')
  )
  with check (
    public.has_company_permission(company_id, 'clients.update')
    or public.has_org_permission(organisation_id, 'clients.update')
  );

-- client_contacts: ordinary clients.read/.update (business fields only,
-- never the private tier below).
create policy client_contacts_select
  on client_contacts for select
  to authenticated
  using (public.has_company_permission(company_id, 'clients.read'));

create policy client_contacts_insert
  on client_contacts for insert
  to authenticated
  with check (public.has_company_permission(company_id, 'clients.update'));

create policy client_contacts_update
  on client_contacts for update
  to authenticated
  using (public.has_company_permission(company_id, 'clients.update'))
  with check (public.has_company_permission(company_id, 'clients.update'));

-- client_contact_private: strictly gated on client_contacts.read_private /
-- .manage_private (added in 0044) -- NEVER on clients.read/.update, no
-- matter how broad. Default deny for every role until explicitly granted.
create policy client_contact_private_select
  on client_contact_private for select
  to authenticated
  using (public.has_company_permission(company_id, 'client_contacts.read_private'));

create policy client_contact_private_insert
  on client_contact_private for insert
  to authenticated
  with check (public.has_company_permission(company_id, 'client_contacts.manage_private'));

create policy client_contact_private_update
  on client_contact_private for update
  to authenticated
  using (public.has_company_permission(company_id, 'client_contacts.manage_private'))
  with check (public.has_company_permission(company_id, 'client_contacts.manage_private'));

create policy client_brands_select
  on client_brands for select
  to authenticated
  using (public.has_company_permission(company_id, 'clients.read'));

create policy client_brands_insert
  on client_brands for insert
  to authenticated
  with check (public.has_company_permission(company_id, 'clients.update'));

create policy client_brands_update
  on client_brands for update
  to authenticated
  using (public.has_company_permission(company_id, 'clients.update'))
  with check (public.has_company_permission(company_id, 'clients.update'));
