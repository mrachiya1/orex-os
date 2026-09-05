-- Projects "Notion-like database" pass: nested milestones + a validated
-- custom-property extension layer + per-user view configuration. Structured
-- Phase 004 operational tables (projects, project_tasks, project_deliverables,
-- decisions, etc.) remain the sole source of truth -- this migration only
-- adds (1) a self-referencing parent on project_milestones with integrity
-- guards, and (2) a thin, Zod-validated-at-the-application-layer sidecar for
-- user-defined project metadata that was never going to earn a real column.

-- =====================================================================
-- 1. Nested milestones
-- =====================================================================

alter table project_milestones
  add column if not exists parent_milestone_id uuid references project_milestones(id) on delete cascade;

create index if not exists project_milestones_parent_idx on project_milestones (parent_milestone_id);

-- Guards a client cannot bypass by only checking in React: same project, no
-- self-parent, no cycle, and a sane maximum depth so a malformed chain can't
-- make recursive tree/progress queries pathological.
create or replace function public.enforce_milestone_parent_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_project_id uuid;
  ancestor_id uuid;
  depth integer := 0;
begin
  if new.parent_milestone_id is null then
    return new;
  end if;

  if new.parent_milestone_id = new.id then
    raise exception 'A milestone cannot be its own parent';
  end if;

  select project_id into parent_project_id
  from project_milestones
  where id = new.parent_milestone_id;

  if parent_project_id is null then
    raise exception 'Parent milestone does not exist';
  end if;

  if parent_project_id <> new.project_id then
    raise exception 'Parent milestone must belong to the same project';
  end if;

  -- walk the proposed parent's own ancestry; if new.id ever appears, this
  -- update would create a cycle. Also caps depth at 10 levels.
  ancestor_id := new.parent_milestone_id;
  while ancestor_id is not null loop
    depth := depth + 1;
    if depth > 10 then
      raise exception 'Milestone hierarchy exceeds the maximum supported depth (10)';
    end if;
    if ancestor_id = new.id then
      raise exception 'This would create a circular milestone hierarchy';
    end if;
    select parent_milestone_id into ancestor_id
    from project_milestones
    where id = ancestor_id;
  end loop;

  return new;
end;
$$;

-- Trigger functions are only ever invoked by the trigger mechanism, never
-- meant to be RPC-callable -- revoke from PUBLIC directly this time (see
-- 0025's postmortem: revoking from anon/authenticated alone leaves the
-- PUBLIC-inherited grant intact).
revoke execute on function public.enforce_milestone_parent_integrity() from public;

drop trigger if exists trg_enforce_milestone_parent_integrity on project_milestones;
create trigger trg_enforce_milestone_parent_integrity
  before insert or update of parent_milestone_id, project_id on project_milestones
  for each row
  execute function public.enforce_milestone_parent_integrity();

-- =====================================================================
-- 2. Custom property engine (definitions + values)
-- =====================================================================
-- "System" properties (Status, Priority, Deadline, Client, ...) are the
-- existing real `projects` columns -- they are never rows in this table.
-- Only user-created metadata (Renderer, Platform, Product SKU, ...) lives
-- here. company_id null = an organisation-wide definition (parallel to
-- Phase 003's group-level knowledge_items pattern); almost all definitions
-- will be company-scoped in practice.

create table if not exists project_property_definitions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  name text not null,
  property_type text not null check (property_type in (
    'text', 'number', 'select', 'multi_select', 'status',
    'date', 'person', 'files', 'checkbox', 'url', 'email', 'phone'
  )),
  configuration jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_property_definitions_company_idx
  on project_property_definitions (company_id);

create table if not exists project_property_values (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  project_id uuid not null references projects(id) on delete cascade,
  property_definition_id uuid not null references project_property_definitions(id) on delete cascade,
  value jsonb not null default 'null'::jsonb,
  created_by uuid references user_profiles(id),
  updated_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, property_definition_id)
);

create index if not exists project_property_values_project_idx on project_property_values (project_id);

-- Cross-parent integrity, same pattern as Phase 004.5's
-- enforce_block_section_project_match(): a value's project must actually
-- belong to the same company (or organisation, for an org-wide definition)
-- as the property definition it's answering -- checked at the database
-- level, independent of whatever the application layer already validated.
create or replace function public.enforce_property_value_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  def_company_id uuid;
  def_org_id uuid;
  proj_company_id uuid;
  proj_org_id uuid;
begin
  select company_id, organisation_id into def_company_id, def_org_id
  from project_property_definitions
  where id = new.property_definition_id;

  select company_id, organisation_id into proj_company_id, proj_org_id
  from projects
  where id = new.project_id;

  if def_company_id is not null and def_company_id is distinct from proj_company_id then
    raise exception 'Property definition and project belong to different companies';
  end if;

  if def_org_id is distinct from proj_org_id then
    raise exception 'Property definition and project belong to different organisations';
  end if;

  new.company_id := proj_company_id;
  new.organisation_id := proj_org_id;

  return new;
end;
$$;

revoke execute on function public.enforce_property_value_scope() from public;

drop trigger if exists trg_enforce_property_value_scope on project_property_values;
create trigger trg_enforce_property_value_scope
  before insert or update of project_id, property_definition_id on project_property_values
  for each row
  execute function public.enforce_property_value_scope();

-- =====================================================================
-- 3. Per-user project database view configuration
-- =====================================================================
-- V1 is deliberately narrow: one view per (user, company) rather than a
-- full named/shared multi-view picker -- stores which columns are visible,
-- their order, and the active sort. Never duplicates project rows; purely
-- a rendering preference layer over the same underlying data.

create table if not exists project_views (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  owner_id uuid not null references user_profiles(id) on delete cascade,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, owner_id)
);

-- =====================================================================
-- 4. RLS
-- =====================================================================

alter table project_property_definitions enable row level security;
alter table project_property_values enable row level security;
alter table project_views enable row level security;

create policy project_property_definitions_select
  on project_property_definitions for select
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'projects.read'))
    or (company_id is null and public.has_org_permission(organisation_id, 'projects.read'))
  );

create policy project_property_definitions_insert
  on project_property_definitions for insert
  to authenticated
  with check (
    (company_id is not null and public.has_company_permission(company_id, 'projects.update'))
    or (company_id is null and public.has_org_permission(organisation_id, 'projects.update'))
  );

create policy project_property_definitions_update
  on project_property_definitions for update
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'projects.update'))
    or (company_id is null and public.has_org_permission(organisation_id, 'projects.update'))
  )
  with check (
    (company_id is not null and public.has_company_permission(company_id, 'projects.update'))
    or (company_id is null and public.has_org_permission(organisation_id, 'projects.update'))
  );

create policy project_property_definitions_delete
  on project_property_definitions for delete
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'projects.update'))
    or (company_id is null and public.has_org_permission(organisation_id, 'projects.update'))
  );

create policy project_property_values_select
  on project_property_values for select
  to authenticated
  using (public.has_project_access(project_id, 'projects.read'));

create policy project_property_values_insert
  on project_property_values for insert
  to authenticated
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_property_values_update
  on project_property_values for update
  to authenticated
  using (public.has_project_access(project_id, 'projects.update'))
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_property_values_delete
  on project_property_values for delete
  to authenticated
  using (public.has_project_access(project_id, 'projects.update'));

-- project_views: strictly private to its owner in V1 (no is_shared concept
-- yet -- deliberately deferred, see prompts/007 "Remaining Gaps").
create policy project_views_select
  on project_views for select
  to authenticated
  using (owner_id = auth.uid());

create policy project_views_insert
  on project_views for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and public.has_company_permission(company_id, 'projects.read')
  );

create policy project_views_update
  on project_views for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy project_views_delete
  on project_views for delete
  to authenticated
  using (owner_id = auth.uid());
