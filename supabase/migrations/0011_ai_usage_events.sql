-- Phase 002: ai_usage_events
-- Records operational metadata for every AI gateway call (success or
-- failure). Never stores raw prompt/response content. Append-only, same
-- write-protection pattern as audit_logs: no client-facing INSERT/UPDATE/
-- DELETE policy -- writes happen only via the service-role client from
-- lib/ai/usage.ts, after the gateway has already performed its own
-- permission check for the underlying request.

create table if not exists ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references user_profiles(id),
  organisation_id uuid references organisations(id),
  company_id uuid references companies(id),
  task_alias text not null,
  requested_model text,
  actual_model text,
  provider text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost numeric(12, 6),
  latency_ms integer,
  result_status text not null default 'success' check (result_status in ('success', 'failure')),
  prompt_version text,
  error_classification text,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_company_id_idx on ai_usage_events (company_id);
create index if not exists ai_usage_events_actor_user_id_idx on ai_usage_events (actor_user_id);
create index if not exists ai_usage_events_task_alias_idx on ai_usage_events (task_alias);
create index if not exists ai_usage_events_created_at_idx on ai_usage_events (created_at);

alter table ai_usage_events enable row level security;

create policy ai_usage_events_select
  on ai_usage_events for select
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'ai.use'))
    or (organisation_id is not null and public.has_org_permission(organisation_id, 'ai.use'))
  );
