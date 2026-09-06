-- Widens the seeded "advisor" agent's read access to the real modules that
-- actually exist (Projects detail/at-risk ranking, Decisions) so it can
-- answer real "what needs my attention" questions with live data, not just
-- create tasks. All three are LEVEL 0 (read-only) tools -- this does not
-- change autonomy, risk ceiling, or approval policy for anything mutating.
-- Finance/Clients/Team are deliberately NOT included: those modules have no
-- real backend/data model yet (no migration creates a clients/transactions/
-- financial_accounts table), and registering a tool for a module that
-- doesn't exist would be fabricating capability, not granting it.
update agents
set allowed_tools = array(
  select distinct unnest(allowed_tools || array['projects.get', 'projects.list_at_risk', 'decisions.list'])
),
    updated_at = now()
where agent_key = 'advisor';
