-- Project Folders: organisational grouping only. Folders are never an
-- authorization boundary -- moving a project between folders (or into no
-- folder at all) never changes who can read/write it. All existing
-- projects RLS remains completely authoritative; this migration only adds
-- a nullable folder_id column and its own lightly-scoped table.

create table if not exists project_folders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  name text not null,
  description text,
  parent_folder_id uuid references project_folders(id) on delete cascade,
  position integer not null default 0,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists project_folders_company_idx on project_folders (company_id);
create index if not exists project_folders_parent_idx on project_folders (parent_folder_id);

alter table projects add column if not exists folder_id uuid references project_folders(id) on delete set null;
create index if not exists projects_folder_id_idx on projects (folder_id);

-- Same integrity pattern as project_milestones' parent_milestone_id
-- (migration 0027): same company, no self-parent, no cycle, capped depth.
create or replace function public.enforce_folder_parent_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_company_id uuid;
  ancestor_id uuid;
  depth integer := 0;
begin
  if new.parent_folder_id is null then
    return new;
  end if;

  if new.parent_folder_id = new.id then
    raise exception 'A folder cannot be its own parent';
  end if;

  select company_id into parent_company_id
  from project_folders
  where id = new.parent_folder_id;

  if parent_company_id is null then
    raise exception 'Parent folder does not exist';
  end if;

  if parent_company_id <> new.company_id then
    raise exception 'Parent folder must belong to the same company';
  end if;

  ancestor_id := new.parent_folder_id;
  while ancestor_id is not null loop
    depth := depth + 1;
    if depth > 10 then
      raise exception 'Folder hierarchy exceeds the maximum supported depth (10)';
    end if;
    if ancestor_id = new.id then
      raise exception 'This would create a circular folder hierarchy';
    end if;
    select parent_folder_id into ancestor_id
    from project_folders
    where id = ancestor_id;
  end loop;

  return new;
end;
$$;

-- Revoke from all three surfaces up front this time (0028's lesson).
revoke execute on function public.enforce_folder_parent_integrity() from public, anon, authenticated;

drop trigger if exists trg_enforce_folder_parent_integrity on project_folders;
create trigger trg_enforce_folder_parent_integrity
  before insert or update of parent_folder_id, company_id on project_folders
  for each row
  execute function public.enforce_folder_parent_integrity();

-- A project's folder_id must belong to the same company as the project
-- itself -- a forged/mismatched folder_id must fail, independent of the
-- application layer.
create or replace function public.enforce_project_folder_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  folder_company_id uuid;
begin
  if new.folder_id is null then
    return new;
  end if;

  select company_id into folder_company_id
  from project_folders
  where id = new.folder_id;

  if folder_company_id is null then
    raise exception 'Folder does not exist';
  end if;

  if folder_company_id <> new.company_id then
    raise exception 'Folder must belong to the same company as the project';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_project_folder_scope() from public, anon, authenticated;

drop trigger if exists trg_enforce_project_folder_scope on projects;
create trigger trg_enforce_project_folder_scope
  before insert or update of folder_id, company_id on projects
  for each row
  execute function public.enforce_project_folder_scope();

alter table project_folders enable row level security;

create policy project_folders_select
  on project_folders for select
  to authenticated
  using (public.has_company_permission(company_id, 'projects.read'));

create policy project_folders_insert
  on project_folders for insert
  to authenticated
  with check (public.has_company_permission(company_id, 'projects.update'));

create policy project_folders_update
  on project_folders for update
  to authenticated
  using (public.has_company_permission(company_id, 'projects.update'))
  with check (public.has_company_permission(company_id, 'projects.update'));

create policy project_folders_delete
  on project_folders for delete
  to authenticated
  using (public.has_company_permission(company_id, 'projects.update'));
