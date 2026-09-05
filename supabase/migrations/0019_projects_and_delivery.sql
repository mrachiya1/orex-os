-- Phase 004: Projects and Delivery data model.
--
-- Nine tables (prompts/004-projects-delivery.md section 9, founder-approved
-- final table set, decision #10):
--   projects
--   project_members          -- additional resource-scope restriction, never a grant
--   project_milestones
--   project_tasks
--   project_deliverables
--   project_deliveries       -- append-only delivery history per deliverable
--   project_scope_changes
--   project_readiness_checks -- relational, per founder decision #3 (supersedes jsonb)
--   project_activity         -- operational timeline, distinct from audit_logs
--
-- RLS follows .agents/skills/orex-rls-security/SKILL.md: reuse
-- has_company_permission/has_org_permission where possible, and introduce
-- exactly one new primitive, has_project_access(), which additionally
-- requires an active project_members row for any role with
-- roles.is_resource_scoped = true (0018). has_project_access is additive
-- only -- it can only narrow access relative to has_company_permission,
-- never widen it (founder decision #11).

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  name text not null,
  project_code text not null,
  project_type text not null,
  status text not null default 'draft' check (status in (
    'draft', 'planned', 'active', 'on_hold', 'review',
    'delivery_ready', 'delivered', 'completed', 'cancelled', 'archived'
  )),
  health_state text not null default 'healthy' check (health_state in ('healthy', 'attention', 'at_risk', 'blocked')),
  health_state_source text not null default 'human' check (health_state_source in ('human', 'system', 'ai_recommended')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  owner_id uuid references user_profiles(id),
  lead_id uuid references user_profiles(id),
  client_display_name text,
  description text,
  scope_summary text,
  objectives text,
  start_date date,
  target_date date,
  delivered_at timestamptz,
  completed_at timestamptz,
  internal_notes_classification text not null default 'internal'
    check (internal_notes_classification in ('internal', 'confidential', 'restricted')),
  delivery_ready_confirmed_by uuid references user_profiles(id),
  delivery_ready_confirmed_at timestamptz,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_company_id_idx on projects (company_id);
create index if not exists projects_organisation_id_idx on projects (organisation_id);
create index if not exists projects_status_idx on projects (status);

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references user_profiles(id),
  project_role text not null check (project_role in ('owner', 'lead', 'member', 'contractor')),
  status text not null default 'active' check (status in ('active', 'removed')),
  added_by uuid references user_profiles(id),
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references user_profiles(id),
  unique (project_id, user_id)
);

create index if not exists project_members_project_id_idx on project_members (project_id);
create index if not exists project_members_user_id_idx on project_members (user_id);

create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  owner_id uuid references user_profiles(id),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'blocked', 'skipped')),
  sequence integer not null default 0,
  is_blocking boolean not null default false,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_milestones_project_id_idx on project_milestones (project_id);

create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  milestone_id uuid references project_milestones(id),
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_user_id uuid references user_profiles(id),
  due_date date,
  completed_at timestamptz,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_project_id_idx on project_tasks (project_id);
create index if not exists project_tasks_assignee_user_id_idx on project_tasks (assignee_user_id);

create table if not exists project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  deliverable_type text not null,
  is_required boolean not null default true,
  status text not null default 'in_progress' check (status in ('in_progress', 'internal_review', 'client_review', 'approved', 'rejected')),
  owner_id uuid references user_profiles(id),
  version text,
  due_date date,
  approval_state text not null default 'pending' check (approval_state in ('pending', 'approved', 'rejected')),
  approved_by uuid references user_profiles(id),
  approved_at timestamptz,
  reference_url text,
  reference_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_deliverables_project_id_idx on project_deliverables (project_id);

create table if not exists project_deliveries (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references project_deliverables(id) on delete cascade,
  delivered_by uuid references user_profiles(id),
  delivered_at timestamptz not null default now(),
  version text,
  destination text,
  reference_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists project_deliveries_deliverable_id_idx on project_deliveries (deliverable_id);

create table if not exists project_scope_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  summary text not null,
  reason text,
  impact_summary text,
  requested_by uuid references user_profiles(id),
  approval_state text not null default 'pending' check (approval_state in ('pending', 'approved', 'rejected')),
  approved_by uuid references user_profiles(id),
  approved_at timestamptz,
  is_blocking boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists project_scope_changes_project_id_idx on project_scope_changes (project_id);

create table if not exists project_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  is_required boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'complete', 'skipped')),
  sequence integer not null default 0,
  completed_by uuid references user_profiles(id),
  completed_at timestamptz,
  evidence_note text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_readiness_checks_project_id_idx on project_readiness_checks (project_id);

create table if not exists project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_user_id uuid references user_profiles(id),
  event_type text not null,
  summary text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_activity_project_id_idx on project_activity (project_id);
create index if not exists project_activity_created_at_idx on project_activity (created_at);

-- has_project_access(): the one new RLS primitive Phase 004 needs. Additive
-- only relative to has_company_permission -- it can only narrow access
-- (for roles.is_resource_scoped = true) never widen it. Default deny: a
-- caller who fails every branch gets false, not an error or an implicit
-- allow.
create or replace function public.has_project_access(target_project_id uuid, permission_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from projects p
    join company_members cm on cm.company_id = p.company_id
    join roles r on r.id = cm.role_id
    join role_permissions rp on rp.role_id = r.id
    join permissions perm on perm.id = rp.permission_id
    where p.id = target_project_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and perm.key = permission_key
      and (
        not r.is_resource_scoped
        or exists (
          select 1 from project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
            and pm.status = 'active'
        )
      )
  )
  or exists (
    select 1
    from projects p
    join organisation_members om on om.organisation_id = p.organisation_id
    join role_permissions rp on rp.role_id = om.role_id
    join permissions perm on perm.id = rp.permission_id
    where p.id = target_project_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and perm.key = permission_key
  );
$$;

revoke all on function public.has_project_access from anon;
grant execute on function public.has_project_access to authenticated;

alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_milestones enable row level security;
alter table project_tasks enable row level security;
alter table project_deliverables enable row level security;
alter table project_deliveries enable row level security;
alter table project_scope_changes enable row level security;
alter table project_readiness_checks enable row level security;
alter table project_activity enable row level security;

-- projects: creation has no project row to check resource-scoping against
-- yet, so it uses the plain company/org permission check (matches
-- knowledge_items' INSERT pattern from Phase 003). Every other operation
-- uses has_project_access, which is self-referential-safe (it queries
-- projects by id, not itself as a table-level policy).
create policy projects_select
  on projects for select
  to authenticated
  using (public.has_project_access(id, 'projects.read'));

create policy projects_insert
  on projects for insert
  to authenticated
  with check (
    (company_id is not null and public.has_company_permission(company_id, 'projects.create'))
    or (company_id is null and public.has_org_permission(organisation_id, 'projects.create'))
  );

create policy projects_update
  on projects for update
  to authenticated
  using (public.has_project_access(id, 'projects.update'))
  with check (public.has_project_access(id, 'projects.update'));

-- project_members: assign-permission gated for writes; a resource-scoped
-- user can see their own membership row without independently satisfying
-- has_project_access (avoids a chicken-and-egg read requirement), plus
-- normal project-read access for everyone else.
create policy project_members_select
  on project_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_project_access(project_id, 'projects.read')
  );

create policy project_members_insert
  on project_members for insert
  to authenticated
  with check (public.has_project_access(project_id, 'projects.assign'));

create policy project_members_update
  on project_members for update
  to authenticated
  using (public.has_project_access(project_id, 'projects.assign'))
  with check (public.has_project_access(project_id, 'projects.assign'));

create policy project_milestones_select
  on project_milestones for select
  to authenticated
  using (public.has_project_access(project_id, 'projects.read'));

create policy project_milestones_insert
  on project_milestones for insert
  to authenticated
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_milestones_update
  on project_milestones for update
  to authenticated
  using (public.has_project_access(project_id, 'projects.update'))
  with check (public.has_project_access(project_id, 'projects.update'));

-- project_tasks: the one deliberate exception (section 12) -- an assignee
-- may update their own task's status even without projects.update, so the
-- caller (application code) can narrow the assignee path to status/
-- completed_at only. RLS is the floor permitting either path, exactly like
-- 0006's company_members_update precedent.
create policy project_tasks_select
  on project_tasks for select
  to authenticated
  using (public.has_project_access(project_id, 'projects.read'));

create policy project_tasks_insert
  on project_tasks for insert
  to authenticated
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_tasks_update
  on project_tasks for update
  to authenticated
  using (
    public.has_project_access(project_id, 'projects.update')
    or assignee_user_id = auth.uid()
  )
  with check (
    public.has_project_access(project_id, 'projects.update')
    or assignee_user_id = auth.uid()
  );

create policy project_deliverables_select
  on project_deliverables for select
  to authenticated
  using (public.has_project_access(project_id, 'deliverables.read'));

create policy project_deliverables_insert
  on project_deliverables for insert
  to authenticated
  with check (public.has_project_access(project_id, 'deliverables.create'));

create policy project_deliverables_update
  on project_deliverables for update
  to authenticated
  using (
    public.has_project_access(project_id, 'deliverables.update')
    or public.has_project_access(project_id, 'deliverables.approve')
  )
  with check (
    public.has_project_access(project_id, 'deliverables.update')
    or public.has_project_access(project_id, 'deliverables.approve')
  );

-- project_deliveries: append-only. No UPDATE/DELETE policy at all -- a
-- delivery record, once written, cannot be altered or removed by any
-- client-facing path (founder: "no hard deletion of historical delivery
-- records"). Joins back to project_deliverables for scoping, mirroring
-- Phase 003's knowledge_chunks pattern.
create policy project_deliveries_select
  on project_deliveries for select
  to authenticated
  using (
    exists (
      select 1 from project_deliverables pd
      where pd.id = project_deliveries.deliverable_id
        and public.has_project_access(pd.project_id, 'deliverables.read')
    )
  );

create policy project_deliveries_insert
  on project_deliveries for insert
  to authenticated
  with check (
    exists (
      select 1 from project_deliverables pd
      where pd.id = project_deliveries.deliverable_id
        and public.has_project_access(pd.project_id, 'deliverables.deliver')
    )
  );

create policy project_scope_changes_select
  on project_scope_changes for select
  to authenticated
  using (public.has_project_access(project_id, 'scope_changes.read'));

create policy project_scope_changes_insert
  on project_scope_changes for insert
  to authenticated
  with check (public.has_project_access(project_id, 'scope_changes.create'));

create policy project_scope_changes_update
  on project_scope_changes for update
  to authenticated
  using (public.has_project_access(project_id, 'scope_changes.approve'))
  with check (public.has_project_access(project_id, 'scope_changes.approve'));

create policy project_readiness_checks_select
  on project_readiness_checks for select
  to authenticated
  using (public.has_project_access(project_id, 'projects.read'));

create policy project_readiness_checks_insert
  on project_readiness_checks for insert
  to authenticated
  with check (public.has_project_access(project_id, 'projects.update'));

create policy project_readiness_checks_update
  on project_readiness_checks for update
  to authenticated
  using (public.has_project_access(project_id, 'projects.update'))
  with check (public.has_project_access(project_id, 'projects.update'));

-- project_activity: read-only for clients. All writes happen via the
-- service-role client from lib/projects/activity.ts, exactly like
-- audit_logs and ai_usage_events -- never used as an authorization source,
-- and never directly writable by a client-supplied row.
create policy project_activity_select
  on project_activity for select
  to authenticated
  using (public.has_project_access(project_id, 'projects.read'));
