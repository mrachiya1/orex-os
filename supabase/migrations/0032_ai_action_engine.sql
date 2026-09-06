-- Phase: Orex AI Action Engine (prompts/013-ai-action-engine.md).
--
-- The one durable, authoritative record of every AI-proposed or AI-executed
-- mutation. Its `status` column carries the whole lifecycle
-- (proposed -> approved/rejected -> executed/failed) so this is a single
-- table rather than the conceptually-separate "ai_action_requests" +
-- "ai_action_results" AGENTS.md sketches -- see the prompt's Decisions #3.
--
-- Same write-protection pattern as audit_logs/ai_usage_events: no
-- client-facing INSERT/UPDATE/DELETE policy at all. Every write happens via
-- the service-role client from lib/ai/tools/approval.ts and
-- lib/ai/tools/executor.ts, after the acting user's own permission has
-- already been checked against the real permission system (RLS/has_*
-- helpers) -- this table is an audit trail, never an authorization source.

create table if not exists ai_action_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  project_id uuid references projects(id) on delete set null,
  agent_id text not null,
  actor_user_id uuid not null references user_profiles(id),
  tool_name text not null,
  risk_level smallint not null check (risk_level between 0 and 3),
  status text not null default 'proposed' check (status in (
    'proposed', 'approved', 'rejected', 'executed', 'failed'
  )),
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  reason text,
  requested_at timestamptz not null default now(),
  decided_by uuid references user_profiles(id),
  decided_at timestamptz,
  executed_at timestamptz,
  error_message text
);

create index if not exists ai_action_requests_company_id_idx on ai_action_requests (company_id);
create index if not exists ai_action_requests_project_id_idx on ai_action_requests (project_id);
create index if not exists ai_action_requests_actor_user_id_idx on ai_action_requests (actor_user_id);
create index if not exists ai_action_requests_status_idx on ai_action_requests (status);

alter table ai_action_requests enable row level security;

-- Visible to the requesting user themselves, or to anyone who could approve
-- it in this company/org (ai.approve) -- never to an arbitrary company
-- member just because they can read the company otherwise.
create policy ai_action_requests_select
  on ai_action_requests for select
  to authenticated
  using (
    actor_user_id = auth.uid()
    or (company_id is not null and public.has_company_permission(company_id, 'ai.approve'))
    or (company_id is null and public.has_org_permission(organisation_id, 'ai.approve'))
  );
