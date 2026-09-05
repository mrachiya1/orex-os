import "server-only";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission, hasOrgPermission, PERMISSIONS } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/database/server";
import { embedText } from "@/lib/ai/embeddings";
import type { RetrievedKnowledge, KnowledgeDomain } from "./types";

export interface RetrieveKnowledgeParams {
  /** null = search Orex Group-level knowledge; a company id = that company's knowledge. */
  companyId: string | null;
  organisationId: string;
  domain?: KnowledgeDomain;
  query: string;
  limit?: number;
  includeArchived?: boolean;
}

/**
 * The one reusable Company Brain retrieval implementation
 * (prompts/003-company-brain.md section 14, section 7 "Retrieval") -- both
 * the UI's search and any AI context builder call this, never a second
 * separate semantic-search path.
 *
 * Authenticates -> checks knowledge.read at the correct scope (company or
 * organisation) -> embeds the query -> calls the RLS-enforced
 * match_knowledge_chunks() function (0015_knowledge_retrieval_function.sql)
 * via the normal (non-service-role) server client, so a forged companyId
 * the caller isn't actually a member of returns zero rows regardless of
 * what this function's own permission check evaluates to -- RLS is the
 * real backstop, not this function's logic alone.
 */
export async function retrieveKnowledge(
  params: RetrieveKnowledgeParams
): Promise<RetrievedKnowledge[]> {
  const user = await requireCurrentUser();

  const allowed = params.companyId
    ? await hasPermission(params.companyId, PERMISSIONS.KNOWLEDGE_READ)
    : await hasOrgPermission(params.organisationId, PERMISSIONS.KNOWLEDGE_READ);

  if (!allowed) {
    return [];
  }

  const embedded = await embedText({
    text: params.query,
    classification: "internal",
    actorUserId: user.id,
    organisationId: params.organisationId,
    companyId: params.companyId,
    taskAlias: "knowledge.retrieve",
  });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: JSON.stringify(embedded.embedding),
    filter_company_id: params.companyId,
    filter_organisation_id: params.companyId ? null : params.organisationId,
    filter_domain: params.domain ?? null,
    include_archived: params.includeArchived ?? false,
    match_limit: params.limit ?? 8,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map(
    (row: {
      knowledge_item_id: string;
      chunk_content: string;
      similarity: number;
      title: string;
      domain: KnowledgeDomain;
      item_type: RetrievedKnowledge["itemType"];
      company_id: string | null;
      source_label: string | null;
      verification_status: RetrievedKnowledge["verificationStatus"];
      lifecycle_status: RetrievedKnowledge["lifecycleStatus"];
      classification: RetrievedKnowledge["classification"];
      confidence: number | null;
    }) => ({
      knowledgeItemId: row.knowledge_item_id,
      content: row.chunk_content,
      title: row.title,
      domain: row.domain,
      itemType: row.item_type,
      companyId: row.company_id,
      sourceLabel: row.source_label,
      verificationStatus: row.verification_status,
      lifecycleStatus: row.lifecycle_status,
      classification: row.classification,
      confidence: row.confidence,
      similarity: row.similarity,
    })
  );
}
