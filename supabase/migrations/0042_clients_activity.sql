-- Phase 017: Clients Intelligence V1 -- append-only client timeline.
--
-- Mirrors project_activity (0019) exactly: read-only for clients, every
-- write happens via the service-role client from lib/clients/activity.ts,
-- never a client-supplied row, never used as an authorization source.
-- related_resource_type/id are a reference, not a duplicated payload
-- (prompts/017 section 18) -- e.g. a "scope_change" event points back at
-- the real project_scope_changes row rather than copying its fields.

create table if not exists client_activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,
  actor_user_id uuid references user_profiles(id),
  event_type text not null,
  summary text not null,
  related_resource_type text,
  related_resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_activity_client_id_idx on client_activity (client_id, created_at desc);
create index if not exists client_activity_company_id_idx on client_activity (company_id);

alter table client_activity enable row level security;

create policy client_activity_select
  on client_activity for select
  to authenticated
  using (public.has_company_permission(company_id, 'clients.read'));

-- No INSERT/UPDATE/DELETE policy: append-only, service-role-only writes,
-- exactly like project_activity and audit_logs.
