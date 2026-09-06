import "server-only";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export interface IntelligenceContextSummary {
  activeProjects: number | null;
  knowledgeItems: number | null;
  openDecisions: number | null;
}

/**
 * Real, permission-gated counts for the Current Context panel -- every
 * number shown in Orex Intelligence must come from an authorized query
 * (prompts/015 Decisions #6). A count the caller cannot see is `null` so
 * the panel can omit it rather than show a zero that looks like real data.
 */
export async function getIntelligenceContext(companyId: string): Promise<IntelligenceContextSummary> {
  const supabase = await createServerSupabaseClient();

  const [canProjects, canKnowledge, canDecisions] = await Promise.all([
    hasPermission(companyId, PERMISSIONS.PROJECTS_READ),
    hasPermission(companyId, PERMISSIONS.KNOWLEDGE_READ),
    hasPermission(companyId, PERMISSIONS.DECISIONS_READ),
  ]);

  const [projectsResult, knowledgeResult, decisionsResult] = await Promise.all([
    canProjects
      ? supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .not("status", "in", "(completed,cancelled,archived)")
      : Promise.resolve({ count: null }),
    canKnowledge
      ? supabase.from("knowledge_items").select("id", { count: "exact", head: true }).eq("company_id", companyId)
      : Promise.resolve({ count: null }),
    canDecisions
      ? supabase
          .from("decisions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .not("status", "in", "(decided,closed)")
      : Promise.resolve({ count: null }),
  ]);

  return {
    activeProjects: canProjects ? (projectsResult.count ?? 0) : null,
    knowledgeItems: canKnowledge ? (knowledgeResult.count ?? 0) : null,
    openDecisions: canDecisions ? (decisionsResult.count ?? 0) : null,
  };
}
