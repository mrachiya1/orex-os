-- Phase 001: organisations
-- One row expected: Orex Group.

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table organisations enable row level security;

-- Any authenticated user may read organisation names (needed for the company
-- switcher / sign-in shell). Writes are restricted to service-role only in
-- Phase 001 (no UI path mutates this table).
create policy organisations_select_authenticated
  on organisations for select
  to authenticated
  using (true);

insert into organisations (name, slug)
values ('Orex Group', 'orex-group')
on conflict (slug) do nothing;
