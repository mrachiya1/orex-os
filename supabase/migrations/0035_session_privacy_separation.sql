-- Session privacy separation (prompt 015 hardening, round 2).
--
-- agent_sessions_select/agent_messages_select/agent_attachments_select
-- (migration 0033) granted read access to anyone holding agents.read for
-- the company -- deliberately broad for agent operational visibility
-- (availability/config/run summaries), but that also meant agents.read
-- (held by every Member and Contractor, per the role seed) could read
-- another employee's raw Orex Intelligence conversation content. That is
-- a real privacy gap, not an operational one.
--
-- Fix: a new, separate, explicitly-granted permission
-- (agents.audit_sessions) for reading OTHER users' conversation content.
-- A session's own creator can always read their own conversation. Agent
-- operational visibility (the `agents`, `agent_budgets`, `agent_runs`,
-- `global_ai_controls` tables) is untouched -- those stay on agents.read,
-- since a run summary/status/cost is not the same thing as the human
-- conversation content that produced it.

insert into permissions (key, label, category) values
  ('agents.audit_sessions', 'Read other users'' Orex Intelligence conversations', 'agents')
on conflict (key) do nothing;

-- Least privilege by default: only Founder gets this today. Director/
-- Manager were explicitly left out (not "director implicitly gets
-- everything") -- extend deliberately later if the founder wants
-- oversight delegated, via a one-line follow-up migration, not by
-- assuming it belongs alongside agents.manage.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.key = 'founder' and p.key = 'agents.audit_sessions'
on conflict (role_id, permission_id) do nothing;

drop policy if exists agent_sessions_select on agent_sessions;
create policy agent_sessions_select on agent_sessions for select to authenticated using (
  created_by = auth.uid()
  or (company_id is not null and public.has_company_permission(company_id, 'agents.audit_sessions'))
  or (company_id is null and public.has_org_permission(organisation_id, 'agents.audit_sessions'))
);

drop policy if exists agent_messages_select on agent_messages;
create policy agent_messages_select on agent_messages for select to authenticated using (
  exists (
    select 1 from agent_sessions s
    where s.id = agent_messages.session_id
      and (
        s.created_by = auth.uid()
        or (s.company_id is not null and public.has_company_permission(s.company_id, 'agents.audit_sessions'))
        or (s.company_id is null and public.has_org_permission(s.organisation_id, 'agents.audit_sessions'))
      )
  )
);

drop policy if exists agent_attachments_select on agent_attachments;
create policy agent_attachments_select on agent_attachments for select to authenticated using (
  actor_user_id = auth.uid()
  or (company_id is not null and public.has_company_permission(company_id, 'agents.audit_sessions'))
  or (company_id is null and public.has_org_permission(organisation_id, 'agents.audit_sessions'))
);

-- Unchanged on purpose (operational visibility, not conversation content):
-- agents_select, agent_budgets_select, agent_runs_select,
-- global_ai_controls_select all still key off agents.read.
