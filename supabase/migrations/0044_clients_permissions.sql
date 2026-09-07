-- Phase 017: Clients Intelligence V1 -- new permission keys.
--
-- clients.read/create/update/delete already existed (seeded Phase 001,
-- dormant until this phase) and need no new migration. Four new keys:
--
--   client_contacts.read_private / client_contacts.manage_private
--     Founder decision 2: sensitive contact PII (birthday, personal email/
--     phone, private notes) is never implied by ordinary clients.read.
--     Least-privilege matrix: Founder gets both; Director/Manager/Member/
--     Contractor/Viewer get neither by default (grantable later via
--     company_members.permission_overrides, same mechanism as every other
--     permission -- no new mechanism needed).
--
--   client_credentials.read_metadata / client_credentials.manage
--     Credential metadata (label/type/provider -- never a secret value) is
--     similarly never implied by clients.read. Founder/Director/Manager get
--     both (matches who can already create/update clients); everyone else
--     gets neither.

insert into permissions (key, label, category) values
  ('client_contacts.read_private', 'Read private client contact info', 'clients'),
  ('client_contacts.manage_private', 'Manage private client contact info', 'clients'),
  ('client_credentials.read_metadata', 'Read client credential metadata', 'clients'),
  ('client_credentials.manage', 'Manage client credential metadata', 'clients')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('founder', 'client_contacts.read_private'), ('founder', 'client_contacts.manage_private'),
  ('founder', 'client_credentials.read_metadata'), ('founder', 'client_credentials.manage'),

  ('director', 'client_credentials.read_metadata'), ('director', 'client_credentials.manage'),
  ('manager', 'client_credentials.read_metadata'), ('manager', 'client_credentials.manage')
) as matrix(role_key, permission_key)
join roles r on r.key = matrix.role_key
join permissions p on p.key = matrix.permission_key
on conflict (role_id, permission_id) do nothing;
