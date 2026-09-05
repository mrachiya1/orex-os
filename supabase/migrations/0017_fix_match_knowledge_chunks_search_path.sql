-- The database linter flagged match_knowledge_chunks as having a mutable
-- search_path, unlike has_company_permission/has_org_permission/
-- is_company_member (0006_company_members_and_rls_helpers.sql), which all
-- pin `set search_path = public`. A mutable search_path on a function that
-- queries unqualified table names is a hijacking risk if a malicious schema
-- is ever placed earlier in a caller's search_path. Fix by pinning it the
-- same way the existing helper functions already do.

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  filter_company_id uuid default null,
  filter_organisation_id uuid default null,
  filter_domain text default null,
  include_archived boolean default false,
  match_limit int default 8
)
returns table (
  knowledge_item_id uuid,
  chunk_content text,
  similarity float,
  title text,
  content text,
  domain text,
  item_type text,
  company_id uuid,
  source_label text,
  verification_status text,
  lifecycle_status text,
  classification text,
  confidence numeric
)
language sql
stable
set search_path = public
as $$
  select
    ki.id as knowledge_item_id,
    kc.content as chunk_content,
    1 - (kc.embedding <=> query_embedding) as similarity,
    ki.title,
    ki.content,
    ki.domain,
    ki.item_type,
    ki.company_id,
    ks.source_label,
    ki.verification_status,
    ki.lifecycle_status,
    ki.classification,
    ki.confidence
  from knowledge_chunks kc
  join knowledge_items ki on ki.id = kc.knowledge_item_id
  left join knowledge_sources ks on ks.id = ki.source_id
  where kc.embedding is not null
    and (filter_company_id is null or ki.company_id = filter_company_id)
    and (filter_organisation_id is null or ki.organisation_id = filter_organisation_id)
    and (filter_domain is null or ki.domain = filter_domain)
    and (include_archived or ki.lifecycle_status <> 'archived')
  order by
    (ki.verification_status = 'verified') desc,
    kc.embedding <=> query_embedding
  limit match_limit;
$$;
