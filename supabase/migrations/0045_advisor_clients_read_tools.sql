-- Phase 017: Clients Intelligence V1 -- Founder Advisor read access
-- (founder decision 1). Grants ONLY the 7 read-only (risk 0) clients.*
-- tools -- no mutation tool. Same explicit allowlist-edit pattern as
-- 0037/0038: registering a tool in TOOL_REGISTRY never by itself grants any
-- agent access to it; this migration is the only place that actually
-- widens what the "advisor" agent may call.
update agents
set allowed_tools = array(
      select distinct unnest(
        allowed_tools || array[
          'clients.search',
          'clients.get',
          'clients.projects.list',
          'clients.timeline.list',
          'clients.preferences.list',
          'clients.feedback.list',
          'clients.issues.list'
        ]
      )
    ),
    updated_at = now()
where agent_key = 'advisor';
