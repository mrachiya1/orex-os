-- Phase 004: link Phase 003 decisions to projects, reusing the existing
-- decisions table rather than creating a project_decisions join table
-- (founder decision #9). "on delete set null" -- a decision's value as
-- company knowledge outlives the project it was made on; removing/
-- archiving a project must never take a decision down with it.
--
-- No RLS change to decisions: its existing Phase 003 policies
-- (has_company_permission/has_org_permission against decisions.company_id/
-- organisation_id) are unchanged and remain the only access gate.
-- has_project_access() is never referenced by any decisions policy, so
-- project membership alone never grants broader access to unrelated
-- Company Brain decisions.

alter table decisions add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists decisions_project_id_idx on decisions (project_id);
