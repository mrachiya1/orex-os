-- Phase 001: company_members + shared RLS permission-resolution helpers.
--
-- has_company_permission(company_id, permission_key) mirrors the server-side
-- lib/permissions.hasPermission() resolution rule exactly (see
-- docs/permissions.md "Permission Evaluation Algorithm"):
--   active company_members row for auth.uid() in that company, whose role
--   grants the permission
--   OR an active organisation_members row for auth.uid() covering that
--   company's organisation, whose role grants the permission.
--
-- It is SECURITY DEFINER so it can read company_members/organisation_members
-- rows belonging to other users (required to evaluate "does this company
-- have ANY teammate row for me", not just my own row) while the tables
-- themselves stay locked down by RLS for direct queries.

create table if not exists company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete restrict,
  user_id uuid not null references user_profiles(id) on delete restrict,
  role_id uuid not null references roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'removed')),
  invited_by uuid references user_profiles(id),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_members_company_id_idx on company_members (company_id);
create index if not exists company_members_user_id_idx on company_members (user_id);

create unique index if not exists company_members_one_active_per_user
  on company_members (company_id, user_id)
  where status = 'active';

create or replace function public.has_company_permission(target_company_id uuid, permission_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from company_members cm
    join role_permissions rp on rp.role_id = cm.role_id
    join permissions p on p.id = rp.permission_id
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and p.key = permission_key
  )
  or exists (
    select 1
    from organisation_members om
    join roles r on r.id = om.role_id
    join role_permissions rp on rp.role_id = r.id
    join permissions p on p.id = rp.permission_id
    join companies c on c.organisation_id = om.organisation_id
    where c.id = target_company_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and p.key = permission_key
  );
$$;

create or replace function public.has_org_permission(target_organisation_id uuid, permission_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from organisation_members om
    join role_permissions rp on rp.role_id = om.role_id
    join permissions p on p.id = rp.permission_id
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and p.key = permission_key
  );
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_company_permission(target_company_id, 'companies.read');
$$;

alter table company_members enable row level security;

create policy company_members_select
  on company_members for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.has_company_permission(company_id, 'team.read')
  );

create policy company_members_insert
  on company_members for insert
  to authenticated
  with check (public.has_company_permission(company_id, 'team.invite'));

create policy company_members_update
  on company_members for update
  to authenticated
  using (public.has_company_permission(company_id, 'team.update'))
  with check (public.has_company_permission(company_id, 'team.update'));

-- Removal is modeled as an update (status -> 'removed'), gated separately
-- from generic updates so a team.update holder without team.remove cannot
-- remove someone -- enforced in application code (lib/permissions), since a
-- single UPDATE policy cannot see which columns changed. RLS here permits
-- the update if the caller holds team.update OR team.remove; the server
-- action is responsible for choosing the narrower check per action.
drop policy if exists company_members_update on company_members;
create policy company_members_update
  on company_members for update
  to authenticated
  using (
    public.has_company_permission(company_id, 'team.update')
    or public.has_company_permission(company_id, 'team.remove')
  )
  with check (
    public.has_company_permission(company_id, 'team.update')
    or public.has_company_permission(company_id, 'team.remove')
  );

-- Now that membership tables and helpers exist, replace companies' temporary
-- permissive policy with the real, membership-aware one.
drop policy if exists companies_select_temp_authenticated on companies;
create policy companies_select
  on companies for select
  to authenticated
  using (public.has_company_permission(id, 'companies.read'));

create policy companies_update
  on companies for update
  to authenticated
  using (public.has_company_permission(id, 'companies.update'))
  with check (public.has_company_permission(id, 'companies.update'));
