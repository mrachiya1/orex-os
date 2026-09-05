-- Phase 001: returns the calling user's effective permission keys for a
-- company (union of company-level and organisation-level grants). Used by
-- the invitation flow to enforce "assignable role <= inviter's own
-- permission set" (docs/permissions.md "Invitation Permissions").

create or replace function public.my_effective_permissions(target_company_id uuid)
returns setof text
language sql
security definer
stable
set search_path = public
as $$
  select distinct p.key
  from company_members cm
  join role_permissions rp on rp.role_id = cm.role_id
  join permissions p on p.id = rp.permission_id
  where cm.company_id = target_company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
  union
  select distinct p.key
  from organisation_members om
  join role_permissions rp on rp.role_id = om.role_id
  join permissions p on p.id = rp.permission_id
  join companies c on c.organisation_id = om.organisation_id
  where c.id = target_company_id
    and om.user_id = auth.uid()
    and om.status = 'active';
$$;

revoke execute on function public.my_effective_permissions(uuid) from anon;
