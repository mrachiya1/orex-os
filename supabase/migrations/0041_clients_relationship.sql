-- Phase 017: Clients Intelligence V1 -- relationship intelligence tables.
--
-- client_notes, client_preferences, client_feedback,
-- client_relationship_issues. All gated on the existing clients.read/.update
-- permissions (prompts/017 section 10 -- deliberately not fragmented into
-- per-sub-resource permission keys, since they're all sub-resources of the
-- same client record and the existing role matrix already expresses the
-- right access shape).
--
-- client_preferences mirrors knowledge_items' provenance model (origin_type/
-- verification_status/confidence from 0013) exactly, including the same
-- "AI can never pre-verify itself" hard DB constraint.

create table if not exists client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid references client_contacts(id) on delete set null,
  company_id uuid not null references companies(id) on delete restrict,
  type text not null default 'general'
    check (type in ('general', 'communication', 'preference', 'request', 'concern', 'relationship_update')),
  content text not null,
  source text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists client_notes_client_id_idx on client_notes (client_id, created_at desc);
create index if not exists client_notes_company_id_idx on client_notes (company_id);

create table if not exists client_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid references client_contacts(id) on delete set null,
  company_id uuid not null references companies(id) on delete restrict,
  category text not null default 'general'
    check (category in ('communication', 'creative', 'delivery', 'process', 'meeting', 'presentation', 'general')),
  statement text not null,
  sentiment text not null check (sentiment in ('like', 'dislike', 'preference', 'avoid')),
  origin text not null check (origin in ('human', 'client_direct', 'project', 'meeting', 'ai')),
  knowledge_type text not null default 'observed'
    check (knowledge_type in ('verified', 'observed', 'inference')),
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  verified boolean not null default false,
  source_reference text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same invariant as knowledge_items_ai_never_preverified (0013): an
  -- AI-originated preference can never be inserted or left as verified.
  constraint client_preferences_ai_never_preverified check (
    not (origin = 'ai' and verified)
  )
);

create index if not exists client_preferences_client_id_idx on client_preferences (client_id);
create index if not exists client_preferences_company_id_idx on client_preferences (company_id);

create table if not exists client_feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  contact_id uuid references client_contacts(id) on delete set null,
  company_id uuid not null references companies(id) on delete restrict,
  rating smallint check (rating is null or (rating between 1 and 5)),
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  feedback_type text not null default 'positive' check (feedback_type in (
    'positive', 'neutral', 'concern', 'disappointment', 'misunderstanding',
    'scope_issue', 'communication_issue', 'delivery_issue'
  )),
  content text not null,
  received_at timestamptz not null default now(),
  recorded_by uuid references user_profiles(id),
  source text,
  created_at timestamptz not null default now()
);

create index if not exists client_feedback_client_id_idx on client_feedback (client_id, received_at desc);
create index if not exists client_feedback_company_id_idx on client_feedback (company_id);
create index if not exists client_feedback_project_id_idx on client_feedback (project_id);

create table if not exists client_relationship_issues (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  contact_id uuid references client_contacts(id) on delete set null,
  company_id uuid not null references companies(id) on delete restrict,
  type text not null check (type in (
    'misunderstanding', 'scope_conflict', 'communication_delay', 'delivery_concern', 'payment_concern'
  )),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  reason text not null,
  impact text,
  resolution text,
  lesson text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_relationship_issues_client_id_idx on client_relationship_issues (client_id, status);
create index if not exists client_relationship_issues_company_id_idx on client_relationship_issues (company_id);

alter table client_notes enable row level security;
alter table client_preferences enable row level security;
alter table client_feedback enable row level security;
alter table client_relationship_issues enable row level security;

create policy client_notes_select on client_notes for select to authenticated
  using (public.has_company_permission(company_id, 'clients.read'));
create policy client_notes_insert on client_notes for insert to authenticated
  with check (public.has_company_permission(company_id, 'clients.update'));

create policy client_preferences_select on client_preferences for select to authenticated
  using (public.has_company_permission(company_id, 'clients.read'));
create policy client_preferences_insert on client_preferences for insert to authenticated
  with check (public.has_company_permission(company_id, 'clients.update'));
create policy client_preferences_update on client_preferences for update to authenticated
  using (public.has_company_permission(company_id, 'clients.update'))
  with check (public.has_company_permission(company_id, 'clients.update'));

create policy client_feedback_select on client_feedback for select to authenticated
  using (public.has_company_permission(company_id, 'clients.read'));
create policy client_feedback_insert on client_feedback for insert to authenticated
  with check (public.has_company_permission(company_id, 'clients.update'));

create policy client_relationship_issues_select on client_relationship_issues for select to authenticated
  using (public.has_company_permission(company_id, 'clients.read'));
create policy client_relationship_issues_insert on client_relationship_issues for insert to authenticated
  with check (public.has_company_permission(company_id, 'clients.update'));
create policy client_relationship_issues_update on client_relationship_issues for update to authenticated
  using (public.has_company_permission(company_id, 'clients.update'))
  with check (public.has_company_permission(company_id, 'clients.update'));
