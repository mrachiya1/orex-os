-- Phase 001: user_profiles
-- One row per Supabase Auth identity, created automatically on signup.

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  display_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_profiles enable row level security;

-- Readable by any authenticated user: needed to show teammate names on
-- member lists and audit log actor names. Contains no secret data (email is
-- Internal, not Secret). Only the owner may update their own row.
create policy user_profiles_select_authenticated
  on user_profiles for select
  to authenticated
  using (true);

create policy user_profiles_update_self
  on user_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
