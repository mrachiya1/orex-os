-- Bug: projects_select uses has_project_access(id, ...), which re-queries
-- the `projects` table by id ("from projects p where p.id = target_project_id").
-- Postgres applies the SELECT policy to an INSERT ... RETURNING clause, and
-- within that same INSERT command the just-created row is not yet visible
-- to a fresh self-referencing subquery against its own table (a row is
-- visible to *later* commands in the transaction, not to an independent
-- lookup inside the *same* command that created it). The result: any
-- `.insert({...}).select().single()` on `projects` fails with "new row
-- violates row-level security policy for table projects", even for a user
-- who unambiguously has projects.create/read -- reproduced live via
-- impersonation: a plain insert succeeds, the identical insert+RETURNING
-- fails, and calling has_project_access on the same row as a separate
-- follow-up statement returns true.
--
-- No other table hits this: project_tasks/project_milestones/etc. all
-- reference an *already-existing* parent project via project_id, so their
-- has_project_access(project_id, ...) lookups see a row that existed before
-- the current command. Only `projects`' own SELECT/UPDATE policies look
-- themselves up by the very id being read/written.
--
-- Fix: a policy variant that takes company_id/organisation_id directly from
-- the row already being evaluated (plain columns, no self-join) instead of
-- re-deriving them by querying `projects` again. Read-only for
-- project_members (a different table, not self-referencing) so the
-- resource-scoped-role narrowing behaves identically to has_project_access.

create or replace function public.has_project_access_by_scope(
  target_project_id uuid,
  target_company_id uuid,
  target_organisation_id uuid,
  permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from company_members cm
    join roles r on r.id = cm.role_id
    join role_permissions rp on rp.role_id = r.id
    join permissions perm on perm.id = rp.permission_id
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and perm.key = permission_key
      and (
        not r.is_resource_scoped
        or exists (
          select 1 from project_members pm
          where pm.project_id = target_project_id
            and pm.user_id = auth.uid()
            and pm.status = 'active'
        )
      )
  )
  or exists (
    select 1
    from organisation_members om
    join role_permissions rp on rp.role_id = om.role_id
    join permissions perm on perm.id = rp.permission_id
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and perm.key = permission_key
  );
$$;

revoke execute on function public.has_project_access_by_scope(uuid, uuid, uuid, text) from public;
grant execute on function public.has_project_access_by_scope(uuid, uuid, uuid, text) to authenticated;

drop policy if exists projects_select on projects;
create policy projects_select
  on projects for select
  to authenticated
  using (has_project_access_by_scope(id, company_id, organisation_id, 'projects.read'));

drop policy if exists projects_update on projects;
create policy projects_update
  on projects for update
  to authenticated
  using (has_project_access_by_scope(id, company_id, organisation_id, 'projects.update'))
  with check (has_project_access_by_scope(id, company_id, organisation_id, 'projects.update'));
