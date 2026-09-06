import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/database/server";
import { PERMISSIONS } from "@/lib/permissions";
import type { ToolDefinition } from "./types";

export const decisionsListInputSchema = z.object({
  companyId: z.string().uuid(),
  limit: z.number().int().min(1).max(20).default(10),
});

export interface OpenDecision {
  id: string;
  title: string;
  status: string;
  situation: string;
}

/**
 * LEVEL 0 (read only). Open decisions (not yet decided/closed) for a
 * company -- the normal RLS-bound client, same trust model as
 * projects.search. Never returns ai_recommendation as a fact -- that field
 * is the decision's own AI-assist content, already reviewed on the
 * Decisions page; this tool exposes only the human-authored situation/
 * status, so a downstream synthesis never mistakes an inference for a
 * verified fact.
 */
const decisionsList: ToolDefinition<{ companyId: string; limit?: number }, OpenDecision[]> = {
  name: "decisions.list",
  description: "List this company's open (not yet decided/closed) decisions.",
  domain: "decisions",
  requiredPermission: PERMISSIONS.DECISIONS_READ,
  scopeType: "company",
  riskLevel: 0,
  inputSchema: decisionsListInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("decisions")
      .select("id, title, status, situation")
      .eq("company_id", input.companyId)
      .not("status", "in", "(decided,closed)")
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 10);
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => ({ id: d.id, title: d.title, status: d.status, situation: d.situation }));
  },
};

export const decisionsTools = {
  [decisionsList.name]: decisionsList,
};
