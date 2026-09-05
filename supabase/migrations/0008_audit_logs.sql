-- Phase 001: audit_logs
-- Append-only. No UPDATE/DELETE policy exists for any role -- not even
-- founder -- because none is defined below; Postgres RLS denies by default
-- when no policy matches. Inserts happen only via the server's service-role
-- client through lib/audit.writeAuditLog(), never from the browser client,
-- so there is no client-facing INSERT policy either.

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references user_profiles(id),
  actor_type text not null default 'human' check (actor_type in ('human', 'ai_agent', 'system', 'automation')),
  organisation_id uuid references organisations(id),
  company_id uuid references companies(id),
  resource_type text not null,
  resource_id text,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  approval_status text,
  approval_user_id uuid references user_profiles(id),
  ai_session_id text,
  ai_agent_id text,
  request_metadata jsonb,
  result_status text not null default 'success' check (result_status in ('success', 'failure')),
  error_details text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_company_id_idx on audit_logs (company_id);
create index if not exists audit_logs_actor_user_id_idx on audit_logs (actor_user_id);
create index if not exists audit_logs_created_at_idx on audit_logs (created_at);
create index if not exists audit_logs_resource_idx on audit_logs (resource_type, resource_id);

alter table audit_logs enable row level security;

create policy audit_logs_select
  on audit_logs for select
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'audit.read'))
    or (organisation_id is not null and public.has_org_permission(organisation_id, 'audit.read'))
  );
