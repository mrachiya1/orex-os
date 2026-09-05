-- Phase 001: roles, permissions, role_permissions
-- Global catalogs (not company-scoped). Seeded with the Phase 001 role set
-- and the full permission catalog from docs/permissions.md, including keys
-- unused until later phases (finance, ai, secrets, etc.) so no catalog
-- migration is required when those modules ship.

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;

-- Catalogs are readable by any authenticated user (needed for UI labels,
-- e.g. showing a member's role name). Writes are service-role only in
-- Phase 001 (permissions.manage is enforced in application code, not RLS,
-- because managing the catalog itself has no natural company_id to check).
create policy roles_select_authenticated on roles for select to authenticated using (true);
create policy permissions_select_authenticated on permissions for select to authenticated using (true);
create policy role_permissions_select_authenticated on role_permissions for select to authenticated using (true);

insert into roles (key, label, description, is_system) values
  ('founder', 'Founder', 'Group-wide founder access, granted explicitly via organisation_members.', true),
  ('director', 'Director', 'Company leadership access.', true),
  ('manager', 'Manager', 'Operational management within a company.', true),
  ('finance', 'Finance', 'Finance-scoped access.', true),
  ('project_manager', 'Project Manager', 'Project-scoped operational access.', true),
  ('creative_lead', 'Creative Lead', 'Delivery/creative-scoped access.', true),
  ('member', 'Member', 'Assigned-work access.', true),
  ('contractor', 'Contractor', 'Narrow, typically project-scoped access. No finance, no secrets.', true),
  ('viewer', 'Viewer', 'Read-only access.', true)
on conflict (key) do nothing;

insert into permissions (key, label, category) values
  ('companies.read', 'Read companies', 'companies'),
  ('companies.create', 'Create companies', 'companies'),
  ('companies.update', 'Update companies', 'companies'),
  ('companies.manage', 'Manage companies', 'companies'),
  ('projects.read', 'Read projects', 'projects'),
  ('projects.create', 'Create projects', 'projects'),
  ('projects.update', 'Update projects', 'projects'),
  ('projects.delete', 'Delete projects', 'projects'),
  ('projects.assign', 'Assign projects', 'projects'),
  ('projects.approve', 'Approve projects', 'projects'),
  ('clients.read', 'Read clients', 'clients'),
  ('clients.create', 'Create clients', 'clients'),
  ('clients.update', 'Update clients', 'clients'),
  ('clients.delete', 'Delete clients', 'clients'),
  ('finance.read', 'Read finance', 'finance'),
  ('finance.create', 'Create finance records', 'finance'),
  ('finance.update', 'Update finance records', 'finance'),
  ('finance.approve', 'Approve finance records', 'finance'),
  ('transactions.read', 'Read transactions', 'transactions'),
  ('transactions.create', 'Create transactions', 'transactions'),
  ('transactions.update', 'Update transactions', 'transactions'),
  ('transactions.approve', 'Approve transactions', 'transactions'),
  ('team.read', 'Read team', 'team'),
  ('team.invite', 'Invite team members', 'team'),
  ('team.update', 'Update team members', 'team'),
  ('team.remove', 'Remove team members', 'team'),
  ('permissions.read', 'Read permissions', 'permissions'),
  ('permissions.manage', 'Manage permissions', 'permissions'),
  ('reports.read', 'Read reports', 'reports'),
  ('reports.create', 'Create reports', 'reports'),
  ('ai.use', 'Use AI', 'ai'),
  ('ai.approve', 'Approve AI actions', 'ai'),
  ('ai.manage', 'Manage AI', 'ai'),
  ('audit.read', 'Read audit log', 'audit'),
  ('settings.manage', 'Manage settings', 'settings'),
  ('secrets.read', 'Read secrets metadata', 'secrets'),
  ('secrets.reveal', 'Reveal secrets', 'secrets'),
  ('secrets.manage', 'Manage secrets', 'secrets')
on conflict (key) do nothing;

-- Phase 001 role -> permission matrix (docs/permissions.md Permission Matrix).
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('founder', 'companies.read'), ('founder', 'companies.create'), ('founder', 'companies.update'), ('founder', 'companies.manage'),
  ('founder', 'projects.read'), ('founder', 'projects.create'), ('founder', 'projects.update'), ('founder', 'projects.delete'), ('founder', 'projects.assign'), ('founder', 'projects.approve'),
  ('founder', 'clients.read'), ('founder', 'clients.create'), ('founder', 'clients.update'), ('founder', 'clients.delete'),
  ('founder', 'finance.read'), ('founder', 'finance.create'), ('founder', 'finance.update'), ('founder', 'finance.approve'),
  ('founder', 'transactions.read'), ('founder', 'transactions.create'), ('founder', 'transactions.update'), ('founder', 'transactions.approve'),
  ('founder', 'team.read'), ('founder', 'team.invite'), ('founder', 'team.update'), ('founder', 'team.remove'),
  ('founder', 'permissions.read'), ('founder', 'permissions.manage'),
  ('founder', 'reports.read'), ('founder', 'reports.create'),
  ('founder', 'ai.use'), ('founder', 'ai.approve'), ('founder', 'ai.manage'),
  ('founder', 'audit.read'), ('founder', 'settings.manage'),
  ('founder', 'secrets.read'), ('founder', 'secrets.reveal'), ('founder', 'secrets.manage'),

  ('director', 'companies.read'), ('director', 'companies.update'),
  ('director', 'projects.read'), ('director', 'projects.create'), ('director', 'projects.update'), ('director', 'projects.delete'), ('director', 'projects.assign'), ('director', 'projects.approve'),
  ('director', 'clients.read'), ('director', 'clients.create'), ('director', 'clients.update'), ('director', 'clients.delete'),
  ('director', 'finance.read'), ('director', 'finance.create'), ('director', 'finance.update'), ('director', 'finance.approve'),
  ('director', 'transactions.read'), ('director', 'transactions.create'), ('director', 'transactions.update'), ('director', 'transactions.approve'),
  ('director', 'team.read'), ('director', 'team.invite'), ('director', 'team.update'), ('director', 'team.remove'),
  ('director', 'permissions.read'),
  ('director', 'reports.read'), ('director', 'reports.create'),
  ('director', 'ai.use'), ('director', 'ai.approve'),
  ('director', 'audit.read'),
  ('director', 'secrets.read'),

  ('manager', 'companies.read'),
  ('manager', 'projects.read'), ('manager', 'projects.create'), ('manager', 'projects.update'), ('manager', 'projects.assign'),
  ('manager', 'clients.read'), ('manager', 'clients.create'), ('manager', 'clients.update'),
  ('manager', 'team.read'),
  ('manager', 'reports.read'), ('manager', 'reports.create'),
  ('manager', 'ai.use'),

  ('finance', 'companies.read'),
  ('finance', 'projects.read'),
  ('finance', 'clients.read'),
  ('finance', 'finance.read'), ('finance', 'finance.create'), ('finance', 'finance.update'),
  ('finance', 'transactions.read'), ('finance', 'transactions.create'), ('finance', 'transactions.update'),
  ('finance', 'team.read'),
  ('finance', 'reports.read'),
  ('finance', 'ai.use'),

  ('project_manager', 'companies.read'),
  ('project_manager', 'projects.read'), ('project_manager', 'projects.create'), ('project_manager', 'projects.update'), ('project_manager', 'projects.assign'),
  ('project_manager', 'clients.read'), ('project_manager', 'clients.create'), ('project_manager', 'clients.update'),
  ('project_manager', 'team.read'),
  ('project_manager', 'reports.read'), ('project_manager', 'reports.create'),
  ('project_manager', 'ai.use'),

  ('creative_lead', 'companies.read'),
  ('creative_lead', 'projects.read'), ('creative_lead', 'projects.update'),
  ('creative_lead', 'clients.read'),
  ('creative_lead', 'team.read'),
  ('creative_lead', 'reports.read'), ('creative_lead', 'reports.create'),
  ('creative_lead', 'ai.use'),

  ('member', 'companies.read'),
  ('member', 'projects.read'),
  ('member', 'clients.read'),
  ('member', 'team.read'),
  ('member', 'ai.use'),

  ('contractor', 'companies.read'),
  ('contractor', 'projects.read'),
  ('contractor', 'team.read'),

  ('viewer', 'companies.read'),
  ('viewer', 'projects.read'),
  ('viewer', 'clients.read'),
  ('viewer', 'team.read')
) as matrix(role_key, permission_key)
join roles r on r.key = matrix.role_key
join permissions p on p.key = matrix.permission_key
on conflict (role_id, permission_id) do nothing;
