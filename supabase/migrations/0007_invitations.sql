-- Phase 001: invitations
-- Invitation-based registration. Raw tokens are never stored -- only a
-- SHA-256 hash. Acceptance is performed server-side (service-role client)
-- after validating the token hash + expiry + status in application code;
-- the possession of a valid, unexpired, unused token is itself the
-- authorization for that one operation, so there is no client-facing
-- UPDATE policy for acceptance.

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete restrict,
  role_id uuid not null references roles(id) on delete restrict,
  email text not null,
  token_hash text not null,
  invited_by uuid not null references user_profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_by uuid references user_profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invitations_company_id_idx on invitations (company_id);
create unique index if not exists invitations_token_hash_key on invitations (token_hash);
create index if not exists invitations_email_status_idx on invitations (email, status);

alter table invitations enable row level security;

create policy invitations_select
  on invitations for select
  to authenticated
  using (public.has_company_permission(company_id, 'team.read'));

create policy invitations_insert
  on invitations for insert
  to authenticated
  with check (public.has_company_permission(company_id, 'team.invite'));

-- Revoking an invitation is an update restricted to team.invite holders.
-- Acceptance (status -> 'accepted') is performed by the server using the
-- service-role client and is intentionally not reachable through this
-- policy.
create policy invitations_update_revoke
  on invitations for update
  to authenticated
  using (public.has_company_permission(company_id, 'team.invite'))
  with check (public.has_company_permission(company_id, 'team.invite'));
