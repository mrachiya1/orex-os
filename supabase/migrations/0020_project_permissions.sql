-- Phase 004: deliverables.* / scope_changes.* permission catalog + role
-- matrix. projects.* is reused as-is from Phase 001 (migration 0002) --
-- no changes to its catalog rows or role mapping. projects.delete stays
-- completely dormant (never referenced by any Phase 004 policy or server
-- action) per the founder's explicit instruction.

insert into permissions (key, label, category) values
  ('deliverables.read', 'Read project deliverables', 'deliverables'),
  ('deliverables.create', 'Create project deliverables', 'deliverables'),
  ('deliverables.update', 'Update project deliverables', 'deliverables'),
  ('deliverables.approve', 'Approve project deliverables', 'deliverables'),
  ('deliverables.deliver', 'Record final delivery', 'deliverables'),
  ('scope_changes.read', 'Read scope changes', 'scope_changes'),
  ('scope_changes.create', 'Create scope changes', 'scope_changes'),
  ('scope_changes.approve', 'Approve scope changes', 'scope_changes')
on conflict (key) do nothing;

-- Founder-directed role matrix (prompts/004-projects-delivery.md section 22).
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('founder', 'deliverables.read'), ('founder', 'deliverables.create'), ('founder', 'deliverables.update'), ('founder', 'deliverables.approve'), ('founder', 'deliverables.deliver'),
  ('founder', 'scope_changes.read'), ('founder', 'scope_changes.create'), ('founder', 'scope_changes.approve'),

  ('director', 'deliverables.read'), ('director', 'deliverables.create'), ('director', 'deliverables.update'), ('director', 'deliverables.approve'), ('director', 'deliverables.deliver'),
  ('director', 'scope_changes.read'), ('director', 'scope_changes.create'), ('director', 'scope_changes.approve'),

  ('manager', 'deliverables.read'), ('manager', 'deliverables.create'), ('manager', 'deliverables.update'), ('manager', 'deliverables.approve'), ('manager', 'deliverables.deliver'),
  ('manager', 'scope_changes.read'), ('manager', 'scope_changes.create'), ('manager', 'scope_changes.approve'),

  ('project_manager', 'deliverables.read'), ('project_manager', 'deliverables.create'), ('project_manager', 'deliverables.update'), ('project_manager', 'deliverables.approve'), ('project_manager', 'deliverables.deliver'),
  ('project_manager', 'scope_changes.read'), ('project_manager', 'scope_changes.create'), ('project_manager', 'scope_changes.approve'),

  ('creative_lead', 'deliverables.read'), ('creative_lead', 'deliverables.create'), ('creative_lead', 'deliverables.update'), ('creative_lead', 'deliverables.approve'),
  ('creative_lead', 'scope_changes.read'), ('creative_lead', 'scope_changes.create'),

  ('member', 'deliverables.read'), ('member', 'deliverables.create'), ('member', 'deliverables.update'),
  ('member', 'scope_changes.read'), ('member', 'scope_changes.create'),

  ('contractor', 'deliverables.read'),
  ('contractor', 'scope_changes.read'),

  ('viewer', 'deliverables.read'),
  ('viewer', 'scope_changes.read')
) as matrix(role_key, permission_key)
join roles r on r.key = matrix.role_key
join permissions p on p.key = matrix.permission_key
on conflict (role_id, permission_id) do nothing;
