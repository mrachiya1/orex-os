-- People / Private Profile pass. Reuses the entire Phase 001 identity model
-- (one auth identity, company_members/organisation_members for multi-company
-- access, roles/permissions, invitations) unchanged -- this migration only
-- adds (1) work-profile columns on the existing user_profiles row (broadly
-- readable, same as today), (2) a genuinely private, default-deny profile
-- table, and (3) an architecture-only connections table (no OAuth token
-- storage yet -- see prompts/010 "Deferred Items": implementing real token
-- storage without an approved encryption/KMS decision would be worse than
-- not building it).

-- =====================================================================
-- 1. Work profile (broadly company-visible, same visibility as today)
-- =====================================================================

alter table user_profiles add column if not exists job_title text;
alter table user_profiles add column if not exists department text;
alter table user_profiles add column if not exists timezone text;
alter table user_profiles add column if not exists skills text[] not null default '{}';

-- =====================================================================
-- 2. Private personal profile -- default deny, owner-only, no exceptions
-- =====================================================================
-- Deliberately NOT company-scoped and NOT covered by any company/org
-- permission check. Founder access to company data never implies access to
-- another person's private fields (AGENTS.md "Founder Access Principle").
-- Protection used here is RLS-only (application-layer, not field
-- encryption) -- see prompts/010 for why encryption was not added this
-- pass and what would be required to add it honestly.

create table if not exists user_private_profiles (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  personal_email text,
  personal_phone text,
  birthday date,
  address text,
  private_notes text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_private_profiles enable row level security;

create policy user_private_profiles_select
  on user_private_profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy user_private_profiles_insert
  on user_private_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_private_profiles_update
  on user_private_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No DELETE policy: a user can clear individual fields via UPDATE, but the
-- row itself (and its audit trail of updated_at) is not client-deletable.

-- =====================================================================
-- 3. Personal connections -- architecture placeholder, no tokens yet
-- =====================================================================
-- Records that a connection exists/its scopes/its status only. No token
-- column: a real OAuth integration needs a dedicated encrypted, server-only
-- store designed alongside that integration, not a jsonb column bolted on
-- here speculatively. This table exists so the Connections UI has
-- somewhere real to read "not connected" from, never a fake state.

create table if not exists user_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  provider text not null check (provider in ('notion', 'google_calendar', 'gmail', 'google_drive')),
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'revoked')),
  scopes text[] not null default '{}',
  connected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table user_connections enable row level security;

create policy user_connections_select
  on user_connections for select
  to authenticated
  using (user_id = auth.uid());

create policy user_connections_insert
  on user_connections for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_connections_update
  on user_connections for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_connections_delete
  on user_connections for delete
  to authenticated
  using (user_id = auth.uid());
