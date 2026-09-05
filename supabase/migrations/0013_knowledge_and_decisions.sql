-- Phase 003: Company Brain data model.
--
-- Five tables (prompts/003-company-brain.md sections 7-8, founder-approved
-- decision #4 for the four-dimension knowledge state model):
--   knowledge_sources  -- provenance: what produced a piece of knowledge
--   knowledge_items    -- the knowledge unit itself (fact/document/etc.)
--   knowledge_chunks   -- retrieval unit, 1..N per knowledge_items row,
--                         carries the pgvector embedding
--   decisions          -- decision memory
--   decision_reviews   -- append-only review history per decision
--
-- RLS follows .agents/skills/orex-rls-security/SKILL.md exactly: reuse
-- has_company_permission/has_org_permission (0006_company_members_and_rls_
-- helpers.sql), branch on nullable company_id for group-level rows, and give
-- indirect/child tables (knowledge_chunks, decision_reviews) their own
-- policy that joins back to the parent rather than relying on the parent's
-- policy alone.

create table if not exists knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  source_type text not null check (source_type in (
    'manual_entry', 'pasted_text', 'project', 'client', 'meeting',
    'daily_log', 'decision', 'report', 'system_event', 'external_integration'
  )),
  source_label text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_sources_company_id_idx on knowledge_sources (company_id);
create index if not exists knowledge_sources_organisation_id_idx on knowledge_sources (organisation_id);

create table if not exists knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  source_id uuid not null references knowledge_sources(id) on delete restrict,
  domain text not null check (domain in (
    'identity', 'business', 'strategy', 'goals', 'operations', 'sales', 'knowledge'
  )),
  item_type text not null check (item_type in (
    'fact', 'document', 'vision', 'mission', 'goal', 'service', 'strategy',
    'rule', 'policy', 'process', 'sop', 'lesson', 'win', 'failure', 'research'
  )),
  origin_type text not null check (origin_type in ('human', 'ai_extracted', 'system')),
  verification_status text not null default 'candidate'
    check (verification_status in ('candidate', 'verified', 'rejected')),
  lifecycle_status text not null default 'current'
    check (lifecycle_status in ('current', 'stale', 'superseded', 'archived')),
  title text not null,
  content text not null,
  classification text not null default 'internal'
    check (classification in ('public', 'internal', 'confidential', 'restricted', 'secret')),
  superseded_by uuid references knowledge_items(id),
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_by uuid references user_profiles(id),
  verified_by uuid references user_profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Founder decision: AI-authored content may never be inserted/left as
  -- already-verified. Enforced here as a hard database constraint, not only
  -- in application code, because this is the one invariant that must never
  -- be bypassable by any write path (including a future bug in a server
  -- action). A human ('human') row may be verified immediately (a founder
  -- typing in a fact and self-attesting it); 'system' origin is reserved for
  -- a future phase and treated the same as ai_extracted for this constraint
  -- until that phase defines its own rule.
  constraint knowledge_items_ai_never_preverified check (
    not (origin_type in ('ai_extracted', 'system') and verification_status = 'verified')
  )
);

create index if not exists knowledge_items_company_id_idx on knowledge_items (company_id);
create index if not exists knowledge_items_organisation_id_idx on knowledge_items (organisation_id);
create index if not exists knowledge_items_domain_idx on knowledge_items (domain);
create index if not exists knowledge_items_verification_status_idx on knowledge_items (verification_status);
create index if not exists knowledge_items_lifecycle_status_idx on knowledge_items (lifecycle_status);

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null references knowledge_items(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  section_title text,
  embedding vector(1536),
  embedding_model text,
  embedding_dimension integer,
  embedded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (knowledge_item_id, chunk_index)
);

create index if not exists knowledge_chunks_knowledge_item_id_idx on knowledge_chunks (knowledge_item_id);
create index if not exists knowledge_chunks_embedding_hnsw_idx
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  title text not null,
  owner_id uuid not null references user_profiles(id),
  status text not null default 'proposed'
    check (status in ('proposed', 'decided', 'in_review', 'closed')),
  situation text not null,
  evidence jsonb not null default '[]'::jsonb,
  options jsonb not null default '[]'::jsonb,
  ai_recommendation text,
  chosen_action text,
  expected_result text,
  decision_date date,
  review_date date,
  related_knowledge_item_id uuid references knowledge_items(id),
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decisions_company_id_idx on decisions (company_id);
create index if not exists decisions_organisation_id_idx on decisions (organisation_id);

create table if not exists decision_reviews (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  reviewed_by uuid not null references user_profiles(id),
  review_date date not null default current_date,
  actual_result text not null,
  lesson text,
  created_at timestamptz not null default now()
);

create index if not exists decision_reviews_decision_id_idx on decision_reviews (decision_id);

alter table knowledge_sources enable row level security;
alter table knowledge_items enable row level security;
alter table knowledge_chunks enable row level security;
alter table decisions enable row level security;
alter table decision_reviews enable row level security;

-- knowledge_items: primary policy set, group-scope-branching per
-- orex-rls-security/SKILL.md.
create policy knowledge_items_select
  on knowledge_items for select
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'knowledge.read'))
    or (company_id is null and public.has_org_permission(organisation_id, 'knowledge.read'))
  );

create policy knowledge_items_insert
  on knowledge_items for insert
  to authenticated
  with check (
    (company_id is not null and public.has_company_permission(company_id, 'knowledge.create'))
    or (company_id is null and public.has_org_permission(organisation_id, 'knowledge.create'))
  );

create policy knowledge_items_update
  on knowledge_items for update
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'knowledge.update'))
    or (company_id is null and public.has_org_permission(organisation_id, 'knowledge.update'))
    or (company_id is not null and public.has_company_permission(company_id, 'knowledge.verify'))
    or (company_id is null and public.has_org_permission(organisation_id, 'knowledge.verify'))
  )
  with check (
    (company_id is not null and public.has_company_permission(company_id, 'knowledge.update'))
    or (company_id is null and public.has_org_permission(organisation_id, 'knowledge.update'))
    or (company_id is not null and public.has_company_permission(company_id, 'knowledge.verify'))
    or (company_id is null and public.has_org_permission(organisation_id, 'knowledge.verify'))
  );

-- knowledge_sources: no direct product surface queries this standalone, but
-- it must independently deny access on a direct query, mirroring the
-- knowledge_items scoping rather than relying on the parent relationship.
create policy knowledge_sources_select
  on knowledge_sources for select
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'knowledge.read'))
    or (company_id is null and public.has_org_permission(organisation_id, 'knowledge.read'))
  );

create policy knowledge_sources_insert
  on knowledge_sources for insert
  to authenticated
  with check (
    (company_id is not null and public.has_company_permission(company_id, 'knowledge.create'))
    or (company_id is null and public.has_org_permission(organisation_id, 'knowledge.create'))
  );

-- knowledge_chunks: no company_id of its own -- join back to the parent
-- knowledge_items row for every check, per orex-rls-security/SKILL.md
-- "Indirect Tables."
create policy knowledge_chunks_select
  on knowledge_chunks for select
  to authenticated
  using (
    exists (
      select 1 from knowledge_items ki
      where ki.id = knowledge_chunks.knowledge_item_id
        and (
          (ki.company_id is not null and public.has_company_permission(ki.company_id, 'knowledge.read'))
          or (ki.company_id is null and public.has_org_permission(ki.organisation_id, 'knowledge.read'))
        )
    )
  );

create policy knowledge_chunks_insert
  on knowledge_chunks for insert
  to authenticated
  with check (
    exists (
      select 1 from knowledge_items ki
      where ki.id = knowledge_chunks.knowledge_item_id
        and (
          (ki.company_id is not null and public.has_company_permission(ki.company_id, 'knowledge.create'))
          or (ki.company_id is null and public.has_org_permission(ki.organisation_id, 'knowledge.create'))
        )
    )
  );

-- decisions
create policy decisions_select
  on decisions for select
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'decisions.read'))
    or (company_id is null and public.has_org_permission(organisation_id, 'decisions.read'))
  );

create policy decisions_insert
  on decisions for insert
  to authenticated
  with check (
    (company_id is not null and public.has_company_permission(company_id, 'decisions.create'))
    or (company_id is null and public.has_org_permission(organisation_id, 'decisions.create'))
  );

create policy decisions_update
  on decisions for update
  to authenticated
  using (
    (company_id is not null and public.has_company_permission(company_id, 'decisions.update'))
    or (company_id is null and public.has_org_permission(organisation_id, 'decisions.update'))
  )
  with check (
    (company_id is not null and public.has_company_permission(company_id, 'decisions.update'))
    or (company_id is null and public.has_org_permission(organisation_id, 'decisions.update'))
  );

-- decision_reviews: indirect table, join back to decisions.
create policy decision_reviews_select
  on decision_reviews for select
  to authenticated
  using (
    exists (
      select 1 from decisions d
      where d.id = decision_reviews.decision_id
        and (
          (d.company_id is not null and public.has_company_permission(d.company_id, 'decisions.read'))
          or (d.company_id is null and public.has_org_permission(d.organisation_id, 'decisions.read'))
        )
    )
  );

create policy decision_reviews_insert
  on decision_reviews for insert
  to authenticated
  with check (
    exists (
      select 1 from decisions d
      where d.id = decision_reviews.decision_id
        and (
          (d.company_id is not null and public.has_company_permission(d.company_id, 'decisions.review'))
          or (d.company_id is null and public.has_org_permission(d.organisation_id, 'decisions.review'))
        )
    )
  );
