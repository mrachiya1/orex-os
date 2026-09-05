-- Phase 003: semantic retrieval function for Company Brain.
--
-- Deliberately NOT security definer (the default for a plain "language sql"
-- function is security invoker) -- it must run as the calling user so
-- knowledge_items/knowledge_chunks RLS policies apply exactly as they would
-- to a direct query. This is the one reusable retrieval implementation
-- (prompts/003-company-brain.md section 14 / section 7 "Retrieval") called
-- by lib/knowledge/retrieval.ts for both the UI and any AI context builder
-- -- never a second, separate semantic-search query path.

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

revoke all on function public.match_knowledge_chunks from anon;
grant execute on function public.match_knowledge_chunks to authenticated;
