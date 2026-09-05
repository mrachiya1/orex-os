-- Phase 004 closure hardening: decisions.project_id cross-company integrity.
--
-- Previously enforced only in app/actions/project-decisions.ts (comparing
-- the decision's company_id/organisation_id against the target project's
-- before writing project_id). That check is still correct and stays in
-- place, but it was the one place in Phase 004 where a database-level
-- safeguard was missing -- a bug in that single application check point
-- was the only thing preventing a cross-company decision/project link.
--
-- This trigger makes the invariant a real database constraint: no row in
-- decisions may ever have a non-null project_id pointing at a project in a
-- different organisation/company than the decision itself, regardless of
-- which code path performs the write (including a future service-role
-- path that might forget the application-level check).

create or replace function public.enforce_decision_project_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proj record;
begin
  if new.project_id is not null then
    select organisation_id, company_id into proj from projects where id = new.project_id;
    if not found then
      raise exception 'decisions.project_id references a non-existent project';
    end if;
    if proj.organisation_id is distinct from new.organisation_id
       or proj.company_id is distinct from new.company_id then
      raise exception 'decisions.project_id must reference a project within the same organisation/company scope as the decision';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists decisions_project_scope_check on decisions;
create trigger decisions_project_scope_check
before insert or update on decisions
for each row execute function public.enforce_decision_project_scope();
