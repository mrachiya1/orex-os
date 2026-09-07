-- Phase 017: Clients Intelligence V1 -- project linking + real typed
-- Project Value (founder decision 3, supersedes the custom-property
-- heuristic originally sketched in prompts/017).
--
-- projects.client_display_name is kept, untouched -- no destructive
-- migration, no fuzzy-name auto-linking (prompts/017 section "Old Custom
-- Property Data" / spec section 76). New projects may set client_id; old
-- ones stay as free text until a human manually links them.
--
-- has_client_access() is defined here (not in 0039) because it needs
-- projects.client_id to exist for its resource-scoping branch -- mirrors
-- how 0018 (is_resource_scoped column) preceded 0019 (has_project_access).

alter table projects add column if not exists client_id uuid references clients(id) on delete set null;
alter table projects add column if not exists client_brand_id uuid references client_brands(id) on delete set null;
alter table projects add column if not exists primary_client_contact_id uuid references client_contacts(id) on delete set null;

-- Integer minor units only -- never floating-point money (founder decision
-- 3). Project Value = the current agreed/commercial value of the project.
-- It is NOT cash received, recognized revenue, profit, invoice amount, or
-- receivable -- those belong to a future Finance/Transactions module this
-- phase does not touch. The DB only validates shape (>=0, 3 uppercase
-- letters); real ISO-4217 membership is validated at the application layer
-- (lib/finance/currency.ts), matching how internal_notes_classification-
-- style checks are already split between DB shape and app business rules
-- elsewhere in this repo.
alter table projects add column if not exists project_value_minor bigint
  check (project_value_minor is null or project_value_minor >= 0);
alter table projects add column if not exists currency_code char(3)
  check (currency_code is null or currency_code ~ '^[A-Z]{3}$');

create index if not exists projects_client_id_idx on projects (client_id);
create index if not exists projects_client_brand_id_idx on projects (client_brand_id);

-- Cross-company integrity: a project's client (and brand/contact, which are
-- themselves always same-company as their client) must belong to the same
-- company as the project itself -- mirrors 0022's decisions.project_id
-- integrity constraint exactly.
create or replace function public.enforce_project_client_company_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_company uuid;
  brand_company uuid;
  contact_company uuid;
begin
  if new.client_id is not null then
    select company_id into client_company from clients where id = new.client_id;
    if client_company is null or client_company is distinct from new.company_id then
      raise exception 'projects.client_id must belong to the same company as the project';
    end if;
  end if;

  if new.client_brand_id is not null then
    select company_id into brand_company from client_brands where id = new.client_brand_id;
    if brand_company is null or brand_company is distinct from new.company_id then
      raise exception 'projects.client_brand_id must belong to the same company as the project';
    end if;
  end if;

  if new.primary_client_contact_id is not null then
    select company_id into contact_company from client_contacts where id = new.primary_client_contact_id;
    if contact_company is null or contact_company is distinct from new.company_id then
      raise exception 'projects.primary_client_contact_id must belong to the same company as the project';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_project_client_company_match() from public;

drop trigger if exists trg_enforce_project_client_company_match on projects;
create trigger trg_enforce_project_client_company_match
  before insert or update of client_id, client_brand_id, primary_client_contact_id, company_id on projects
  for each row
  execute function public.enforce_project_client_company_match();

-- has_client_access(): mirrors has_project_access() (0019) exactly -- an
-- active company_members role grant with the permission, additionally
-- requiring (only for roles.is_resource_scoped = true, i.e. Contractor
-- today) an active project_members row on at least one project linked to
-- this client. Additive-only: can never widen access relative to a plain
-- company-level grant, only narrow it for resource-scoped roles. An
-- org-wide organisation_members grant bypasses the resource-scoping check
-- entirely, same as has_project_access.
create or replace function public.has_client_access(target_client_id uuid, permission_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from clients c
    join company_members cm on cm.company_id = c.company_id
    join roles r on r.id = cm.role_id
    join role_permissions rp on rp.role_id = r.id
    join permissions perm on perm.id = rp.permission_id
    where c.id = target_client_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and perm.key = permission_key
      and (
        not r.is_resource_scoped
        or exists (
          select 1
          from project_members pm
          join projects p on p.id = pm.project_id
          where p.client_id = c.id
            and pm.user_id = auth.uid()
            and pm.status = 'active'
        )
      )
  )
  or exists (
    select 1
    from clients c
    join organisation_members om on om.organisation_id = c.organisation_id
    join role_permissions rp on rp.role_id = om.role_id
    join permissions perm on perm.id = rp.permission_id
    where c.id = target_client_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and perm.key = permission_key
  );
$$;

revoke all on function public.has_client_access from anon;
grant execute on function public.has_client_access to authenticated;

-- Replace the company-only clients_select policy from 0039 with the
-- resource-scoping-aware version now that has_client_access exists. Insert/
-- update stay on has_company_permission/has_org_permission -- there is no
-- client row yet at insert time, and narrowing update access the same way
-- read is narrowed adds no real protection here since a Contractor has no
-- clients.update grant in the base role matrix (client mutation is a
-- Manager+ capability by default); if that ever changes via a permission
-- override, has_client_access's same narrowing logic already covers it
-- symmetrically for reads, which is the higher-value protection.
drop policy if exists clients_select on clients;
create policy clients_select
  on clients for select
  to authenticated
  using (public.has_client_access(id, 'clients.read'));
