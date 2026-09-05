-- Per-member permission overrides. Additive and backward-compatible: every
-- existing company_members row gets permission_overrides = '{}', which
-- means has_company_permission()'s behavior is byte-for-byte identical to
-- before for every row that has never used this feature. Only rows that
-- explicitly set an override key change behavior for that one permission.
--
-- Design constraints (deliberately narrow):
--   - Overrides live on company_members, so they only ever affect that
--     specific company membership's COMPANY-level check. The organisation-
--     level branch (Founder / org-wide grants) is completely untouched --
--     an override can never widen or narrow anyone's org-level access.
--   - An override can grant a permission the role wouldn't (true) or
--     revoke one it would (false) for that one person, in that one
--     company. It never changes the role itself or anyone else holding it.
--   - Escalation prevention happens in application code (inviteMember /
--     updateMemberPermissionOverrides): setting an override to `true`
--     requires the actor to already hold that permission themself, exactly
--     like assigning a role already requires isRoleAssignable(). Setting
--     an override to `false` is always allowed -- restricting someone is
--     never an escalation.

alter table company_members add column if not exists permission_overrides jsonb not null default '{}'::jsonb;
alter table invitations add column if not exists permission_overrides jsonb;

create or replace function public.has_company_permission(target_company_id uuid, permission_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select (cm.permission_overrides ->> permission_key)::boolean
      from company_members cm
      where cm.company_id = target_company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.permission_overrides ? permission_key
      limit 1
    ),
    exists (
      select 1
      from company_members cm
      join role_permissions rp on rp.role_id = cm.role_id
      join permissions p on p.id = rp.permission_id
      where cm.company_id = target_company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and p.key = permission_key
    )
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

-- Simplified to delegate to has_company_permission per catalog permission,
-- so the two functions cannot drift -- this also means overrides are
-- automatically reflected in "my effective permissions" (used by the
-- invite flow's escalation check) with no separate logic to keep in sync.
create or replace function public.my_effective_permissions(target_company_id uuid)
returns setof text
language sql
security definer
stable
set search_path = public
as $$
  select p.key
  from permissions p
  where public.has_company_permission(target_company_id, p.key);
$$;

-- Bonus fix while touching these two functions: the advisor previously
-- flagged (Phase 004.5 closure notes) that these carry the same PUBLIC-
-- inherited-grant issue fixed elsewhere in 0025/0028 for other functions.
-- Fixing it here since CREATE OR REPLACE does not reset existing grants.
revoke execute on function public.has_company_permission(uuid, text) from public, anon, authenticated;
grant execute on function public.has_company_permission(uuid, text) to authenticated;

revoke execute on function public.my_effective_permissions(uuid) from public, anon, authenticated;
grant execute on function public.my_effective_permissions(uuid) to authenticated;
