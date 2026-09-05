-- Phase 004: resource-scoping foundation for project-level access.
--
-- roles.is_resource_scoped marks a role as needing an explicit project_members
-- row (in addition to normal company-level permission) to access a specific
-- project -- see prompts/004-projects-delivery.md section 10/23 and the
-- founder's decision #11: "Project membership may RESTRICT access. It must
-- never expand access beyond valid organisation/company authorization."
--
-- Defaults to false for every existing role (safe default -- Founder,
-- Director, Manager, Finance, Project Manager, Creative Lead, Member, and
-- Viewer are all unaffected and continue to see every project their
-- company-level permission already allows). Only Contractor is marked true.

alter table roles add column if not exists is_resource_scoped boolean not null default false;

update roles set is_resource_scoped = true where key = 'contractor';
