-- Cosmetic only: align the seeded advisor agent's display name with the
-- Orex Intelligence redesign (prompts/015). No behavior change -- agent_key,
-- tools, autonomy, and risk level are untouched.
update agents
set name = 'Founder Advisor',
    updated_at = now()
where agent_key = 'advisor';
