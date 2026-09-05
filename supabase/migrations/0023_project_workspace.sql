-- Phase 004.5: Project Workspace.
--
-- Two tables layered on top of the Phase 004 project system, never
-- replacing it: project_sections (system-section presentation state +
-- custom content containers) and project_blocks (flexible content inside
-- custom sections). Reuses has_project_access() unmodified -- no new RLS
-- primitive, no new permission keys (projects.read / projects.update only).

create table if not exists project_sections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  section_type text not null check (section_type in ('system', 'custom')),
  system_key text check (system_key in (
    'milestones', 'tasks', 'deliverables', 'readiness',
    'scope', 'team', 'decisions', 'activity'
  )),
  position integer not null default 0,
  is_collapsed boolean not null default false,
  is_hidden boolean not null default false,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_sections_system_key_matches_type check (
    (section_type = 'system' and system_key is not null)
    or (section_type = 'custom' and system_key is null)
  )
);

create index if not exists project_sections_project_id_idx on project_sections (project_id);

create table if not exists project_blocks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  project_id uuid not null references projects(id) on delete cascade,
  section_id uuid not null references project_sections(id) on delete cascade,
  block_type text not null check (block_type in (
    'text', 'heading', 'callout', 'checklist', 'table', 'divider', 'link', 'project_view'
  )),
  position integer not null default 0,
  content jsonb not null default '{}'::jsonb,
  created_by uuid references user_profiles(id),
  updated_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_blocks_project_id_idx on project_blocks (project_id);
create index if not exists project_blocks_section_id_idx on project_blocks (section_id);

-- Cross-project integrity: a block's project_id must always match its
-- section's project_id, at the database level, regardless of which code
-- path performs the write -- mirrors enforce_decision_project_scope from
-- the Phase 004 closure hardening (migration 0022).
create or replace function public.enforce_block_section_project_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sec record;
begin
  select project_id into sec from project_sections where id = new.section_id;
  if not found then
    raise exception 'project_blocks.section_id references a non-existent section';
  end if;
  if sec.project_id is distinct from new.project_id then
    raise exception 'project_blocks.project_id must match its section''s project_id';
  end if;
  return new;
end;
$$;

drop trigger if exists project_blocks_section_project_check on project_blocks;
create trigger project_blocks_section_project_check
before insert or update on project_blocks
for each row execute function public.enforce_block_section_project_match();

alter table project_sections enable row level security;
alter table project_blocks enable row level security;

create policy project_sections_select
  on project_sections for select
  to authenticated
  using (public.has_project_access(project_id, 'projects.read'));

create policy project_sections_insert
  on project_sections for insert
  to authenticated
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_sections_update
  on project_sections for update
  to authenticated
  using (public.has_project_access(project_id, 'projects.update'))
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_sections_delete
  on project_sections for delete
  to authenticated
  using (public.has_project_access(project_id, 'projects.update'));

create policy project_blocks_select
  on project_blocks for select
  to authenticated
  using (public.has_project_access(project_id, 'projects.read'));

create policy project_blocks_insert
  on project_blocks for insert
  to authenticated
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_blocks_update
  on project_blocks for update
  to authenticated
  using (public.has_project_access(project_id, 'projects.update'))
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_blocks_delete
  on project_blocks for delete
  to authenticated
  using (public.has_project_access(project_id, 'projects.update'));
