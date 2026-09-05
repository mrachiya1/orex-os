-- Phase 001: organisation_members
-- Explicit, auditable, revocable group-level access grants. This is the ONLY
-- mechanism that grants access across every company in an organisation
-- (used for the founder). There is no hardcoded role bypass anywhere in
-- application code -- see docs/permissions.md "Founder Access".
--
-- Granting/revoking is founder-only (permissions.manage) and is enforced in
-- application code using a service-role server client, not by a client-side
-- RLS insert/update policy -- there is no natural "permission to grant
-- organisation-wide access" check that RLS alone can express safely for the
-- very first grant (see prompts/001-foundation.md Open Questions #1, the
-- founder-bootstrap decision). Only SELECT is exposed to authenticated
-- clients, and only for a user's own rows.

create table if not exists organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  user_id uuid not null references user_profiles(id) on delete restrict,
  role_id uuid not null references roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'removed')),
  granted_by uuid references user_profiles(id),
  granted_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organisation_members_org_id_idx on organisation_members (organisation_id);
create index if not exists organisation_members_user_id_idx on organisation_members (user_id);

create unique index if not exists organisation_members_one_active_per_user
  on organisation_members (organisation_id, user_id)
  where status = 'active';

alter table organisation_members enable row level security;

create policy organisation_members_select_self
  on organisation_members for select
  to authenticated
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy for the authenticated role: grants are
-- written only by the server using the service-role client, after an
-- application-code permissions.manage check (see lib/permissions).
