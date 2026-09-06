-- Grants the seeded "advisor" agent access to the new batch task-import
-- tool (production failure fix: pasted checklists). Same risk level (1,
-- CONFIRM_TO_ACT) as the existing single-task tool -- no autonomy/risk
-- policy change, only widening the allowlist.
update agents
set allowed_tools = array(select distinct unnest(allowed_tools || array['projects.tasks.create_batch'])),
    updated_at = now()
where agent_key = 'advisor'
  and not ('projects.tasks.create_batch' = any(allowed_tools));
