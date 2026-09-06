-- Orex Intelligence foundation (prompts/014-orex-intelligence.md).
--
-- Moves the agent registry from static TypeScript config (lib/ai/agents/
-- registry.ts, prompts/013) into the database, adds persistent chat
-- sessions/messages, per-company global AI controls, agent run history,
-- budget accounting on top of the EXISTING ai_usage_events table (no
-- duplicate ledger), and reference-type attachments. Real binary file/
-- image/voice upload is explicitly deferred (see the prompt's Decisions
-- #7) -- the attachment table's storage-related columns exist but are
-- unused this pass.

-- =====================================================================
-- 1. Agents (replaces the static AGENT_REGISTRY)
-- =====================================================================

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique, -- globally unique for now (single-org reality) -- see prompt Decisions
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict, -- null = usable org-wide
  name text not null,
  description text not null,
  enabled boolean not null default true,
  mode text not null default 'MANUAL' check (mode in ('OFF', 'MANUAL', 'SCHEDULED', 'AUTO_SAFE')),
  autonomy_mode text not null check (autonomy_mode in ('READ_ONLY', 'SUGGEST_ONLY', 'CONFIRM_TO_ACT', 'AUTO_SAFE')),
  allowed_tools text[] not null default '{}',
  max_risk_level smallint not null default 0 check (max_risk_level between 0 and 3),
  default_model_alias text not null, -- validated against TaskAlias in application code, not a DB fk
  disable_after_current_run boolean not null default false,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_organisation_id_idx on agents (organisation_id);
create index if not exists agents_company_id_idx on agents (company_id);

create table if not exists agent_budgets (
  agent_id uuid primary key references agents(id) on delete cascade,
  daily_budget_usd numeric(10, 4),
  monthly_budget_usd numeric(10, 4),
  max_daily_runs integer,
  max_context_tokens integer,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 2. Per-company global AI controls (founder-confirmed: Orextic and Orex
--    Studios manage this independently -- never a single org-wide row)
-- =====================================================================

create table if not exists global_ai_controls (
  company_id uuid primary key references companies(id) on delete cascade,
  paused boolean not null default false,
  background_agents_enabled boolean not null default true,
  scheduled_agents_enabled boolean not null default true,
  auto_safe_actions_enabled boolean not null default true,
  updated_by uuid references user_profiles(id),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3. Agent runs (history)
-- =====================================================================

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  session_id uuid, -- FK added after agent_sessions exists, below
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  actor_user_id uuid not null references user_profiles(id),
  goal text,
  status text not null default 'queued' check (status in (
    'queued', 'planning', 'waiting_approval', 'executing',
    'completed', 'partial', 'failed', 'cancelled', 'paused'
  )),
  model_alias text,
  result jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_agent_id_idx on agent_runs (agent_id);
create index if not exists agent_runs_company_id_idx on agent_runs (company_id);
create index if not exists agent_runs_status_idx on agent_runs (status);

-- =====================================================================
-- 4. Sessions and messages
-- =====================================================================

create table if not exists agent_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  created_by uuid not null references user_profiles(id),
  title text not null,
  goal text,
  primary_agent_id uuid not null references agents(id),
  summary text, -- rolling summary, regenerated once message count crosses a threshold -- see lib/ai/sessions/summary.ts
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists agent_sessions_company_id_idx on agent_sessions (company_id);
create index if not exists agent_sessions_created_by_idx on agent_sessions (created_by);

alter table agent_runs add constraint agent_runs_session_id_fkey
  foreign key (session_id) references agent_sessions(id) on delete set null;
create index if not exists agent_runs_session_id_idx on agent_runs (session_id);

create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references agent_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb, -- agentId, modelAlias, usageEventId, evidence, toolReference, approvalReference -- informational only, never authoritative
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_session_id_idx on agent_messages (session_id);

-- =====================================================================
-- 5. Attachments (Tier A: reference-type only -- see prompt Decisions #7)
-- =====================================================================

create table if not exists agent_attachments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references agent_sessions(id) on delete cascade,
  message_id uuid references agent_messages(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  actor_user_id uuid not null references user_profiles(id),
  attachment_type text not null check (attachment_type in (
    'image', 'file', 'pdf', 'audio',
    'project_ref', 'knowledge_ref', 'decision_ref', 'session_ref'
  )),
  -- Tier A (implemented this pass): a reference to an existing record.
  reference_id uuid,
  -- Tier B (schema only, unused this pass -- real binary upload is deferred):
  storage_path text,
  transcript text,
  classification text check (classification in ('public', 'internal', 'confidential', 'restricted', 'secret')),
  status text not null default 'ready' check (status in ('ready', 'analyzing', 'analyzed', 'rejected')),
  created_at timestamptz not null default now(),
  constraint agent_attachments_reference_type_requires_id check (
    attachment_type not in ('project_ref', 'knowledge_ref', 'decision_ref', 'session_ref')
    or reference_id is not null
  )
);

create index if not exists agent_attachments_session_id_idx on agent_attachments (session_id);

-- =====================================================================
-- 6. Agent attribution on ai_usage_events (no duplicate accounting table)
-- =====================================================================

alter table ai_usage_events add column if not exists agent_id uuid references agents(id);
alter table ai_usage_events add column if not exists agent_run_id uuid references agent_runs(id);
create index if not exists ai_usage_events_agent_id_idx on ai_usage_events (agent_id);

-- =====================================================================
-- 7. RLS
-- =====================================================================

alter table agents enable row level security;
alter table agent_budgets enable row level security;
alter table global_ai_controls enable row level security;
alter table agent_runs enable row level security;
alter table agent_sessions enable row level security;
alter table agent_messages enable row level security;
alter table agent_attachments enable row level security;

create policy agents_select on agents for select to authenticated using (
  (company_id is not null and public.has_company_permission(company_id, 'agents.read'))
  or (company_id is null and public.has_org_permission(organisation_id, 'agents.read'))
);
-- No client-facing INSERT/UPDATE/DELETE policy -- writes go through the
-- service-role client from app/actions/agents.ts, after an agents.manage
-- check in application code (mirrors ai_action_requests' pattern).

create policy agent_budgets_select on agent_budgets for select to authenticated using (
  exists (
    select 1 from agents a
    where a.id = agent_budgets.agent_id
      and (
        (a.company_id is not null and public.has_company_permission(a.company_id, 'agents.read'))
        or (a.company_id is null and public.has_org_permission(a.organisation_id, 'agents.read'))
      )
  )
);

create policy global_ai_controls_select on global_ai_controls for select to authenticated using (
  public.has_company_permission(company_id, 'agents.read')
);

create policy agent_runs_select on agent_runs for select to authenticated using (
  actor_user_id = auth.uid()
  or (company_id is not null and public.has_company_permission(company_id, 'agents.read'))
  or (company_id is null and public.has_org_permission(organisation_id, 'agents.read'))
);

create policy agent_sessions_select on agent_sessions for select to authenticated using (
  created_by = auth.uid()
  or (company_id is not null and public.has_company_permission(company_id, 'agents.read'))
  or (company_id is null and public.has_org_permission(organisation_id, 'agents.read'))
);
-- Sessions/messages are written via the service-role client from
-- app/actions/sessions.ts and messages.ts, after an explicit agents.use
-- check -- mirrors ai_action_requests' write pattern (this table is
-- conversation history, not itself an authorization source).

create policy agent_messages_select on agent_messages for select to authenticated using (
  exists (
    select 1 from agent_sessions s
    where s.id = agent_messages.session_id
      and (
        s.created_by = auth.uid()
        or (s.company_id is not null and public.has_company_permission(s.company_id, 'agents.read'))
        or (s.company_id is null and public.has_org_permission(s.organisation_id, 'agents.read'))
      )
  )
);

create policy agent_attachments_select on agent_attachments for select to authenticated using (
  actor_user_id = auth.uid()
  or (company_id is not null and public.has_company_permission(company_id, 'agents.read'))
  or (company_id is null and public.has_org_permission(organisation_id, 'agents.read'))
);

-- =====================================================================
-- 8. Permissions catalog additions
-- =====================================================================

insert into permissions (key, label, category) values
  ('agents.read', 'Read AI agents', 'agents'),
  ('agents.use', 'Use AI agents', 'agents'),
  ('agents.manage', 'Manage AI agents', 'agents'),
  ('agents.enable', 'Enable/disable AI agents', 'agents'),
  ('agents.approve', 'Approve AI agent actions', 'agents')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('founder', 'agents.read'), ('founder', 'agents.use'), ('founder', 'agents.manage'), ('founder', 'agents.enable'), ('founder', 'agents.approve'),
  ('director', 'agents.read'), ('director', 'agents.use'), ('director', 'agents.manage'), ('director', 'agents.enable'), ('director', 'agents.approve'),
  ('manager', 'agents.read'), ('manager', 'agents.use'),
  ('finance', 'agents.read'), ('finance', 'agents.use'),
  ('project_manager', 'agents.read'), ('project_manager', 'agents.use'),
  ('creative_lead', 'agents.read'), ('creative_lead', 'agents.use'),
  ('member', 'agents.read'), ('member', 'agents.use'),
  ('viewer', 'agents.read')
) as matrix(role_key, permission_key)
join roles r on r.key = matrix.role_key
join permissions p on p.key = matrix.permission_key
on conflict (role_id, permission_id) do nothing;

-- =====================================================================
-- 9. Seed today's single "advisor" agent so behavior is unchanged
-- =====================================================================

insert into agents (agent_key, organisation_id, company_id, name, description, enabled, mode, autonomy_mode, allowed_tools, max_risk_level, default_model_alias)
select 'advisor', o.id, null, 'Company Brain Advisor',
  'Answers questions and performs simple, confirmed project actions on the user''s behalf.',
  true, 'MANUAL', 'CONFIRM_TO_ACT', array['projects.search', 'projects.task.create'], 1, 'agent.tools'
from organisations o
on conflict (agent_key) do nothing;
