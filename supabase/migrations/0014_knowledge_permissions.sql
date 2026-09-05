-- Phase 003: knowledge.* and decisions.* permission catalog + role matrix.
-- Founder-approved matrix (prompts/003-company-brain.md section 19),
-- superseding this document's originally-proposed matrix.

insert into permissions (key, label, category) values
  ('knowledge.read', 'Read company knowledge', 'knowledge'),
  ('knowledge.create', 'Create company knowledge', 'knowledge'),
  ('knowledge.update', 'Update company knowledge', 'knowledge'),
  ('knowledge.verify', 'Verify company knowledge', 'knowledge'),
  ('knowledge.manage', 'Manage company knowledge', 'knowledge'),
  ('decisions.read', 'Read decisions', 'decisions'),
  ('decisions.create', 'Create decisions', 'decisions'),
  ('decisions.update', 'Update decisions', 'decisions'),
  ('decisions.review', 'Review decisions', 'decisions')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('founder', 'knowledge.read'), ('founder', 'knowledge.create'), ('founder', 'knowledge.update'), ('founder', 'knowledge.verify'), ('founder', 'knowledge.manage'),
  ('founder', 'decisions.read'), ('founder', 'decisions.create'), ('founder', 'decisions.update'), ('founder', 'decisions.review'),

  ('director', 'knowledge.read'), ('director', 'knowledge.create'), ('director', 'knowledge.update'), ('director', 'knowledge.verify'), ('director', 'knowledge.manage'),
  ('director', 'decisions.read'), ('director', 'decisions.create'), ('director', 'decisions.update'), ('director', 'decisions.review'),

  ('manager', 'knowledge.read'), ('manager', 'knowledge.create'), ('manager', 'knowledge.update'),
  ('manager', 'decisions.read'), ('manager', 'decisions.create'), ('manager', 'decisions.update'), ('manager', 'decisions.review'),

  ('project_manager', 'knowledge.read'), ('project_manager', 'knowledge.create'), ('project_manager', 'knowledge.update'),
  ('project_manager', 'decisions.read'), ('project_manager', 'decisions.create'),

  ('creative_lead', 'knowledge.read'), ('creative_lead', 'knowledge.create'), ('creative_lead', 'knowledge.update'),
  ('creative_lead', 'decisions.read'), ('creative_lead', 'decisions.create'),

  ('member', 'knowledge.read'), ('member', 'knowledge.create'),
  ('member', 'decisions.read'),

  -- Contractor: read-only, and scoped in practice by row-level access
  -- (has_company_permission still requires an active company_members row,
  -- so a contractor with no membership in a given company already gets zero
  -- rows regardless of this grant -- see docs/permissions.md "Contractor
  -- Access" and prompts/003-company-brain.md section 19).
  ('contractor', 'knowledge.read'),
  ('contractor', 'decisions.read'),

  ('viewer', 'knowledge.read'),
  ('viewer', 'decisions.read')
) as matrix(role_key, permission_key)
join roles r on r.key = matrix.role_key
join permissions p on p.key = matrix.permission_key
on conflict (role_id, permission_id) do nothing;
