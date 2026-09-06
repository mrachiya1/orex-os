import "server-only";
import { createServerSupabaseClient } from "@/lib/database/server";
import type { AgentDefinition, AgentRunMode, AutonomyMode } from "@/lib/ai/tools/types";

/**
 * The agent registry moved from static TypeScript config (prompts/013) into
 * the `agents` table (migration 0033) once enable/disable, modes, and
 * budgets needed state that changes without a deploy. `getAgent` is now
 * async -- its one call site (lib/ai/tools/executor.ts's executeTool,
 * already async) absorbs this with a single `await`. A migration seeded
 * today's single "advisor" row so behavior is unchanged until someone
 * actually reconfigures something.
 */

interface AgentRow {
  id: string;
  agent_key: string;
  name: string;
  description: string;
  organisation_id: string;
  company_id: string | null;
  enabled: boolean;
  mode: string;
  autonomy_mode: string;
  allowed_tools: string[];
  max_risk_level: number;
  default_model_alias: string;
  disable_after_current_run: boolean;
}

function mapRow(row: AgentRow): AgentDefinition {
  return {
    id: row.id,
    agentId: row.agent_key,
    name: row.name,
    description: row.description,
    organisationId: row.organisation_id,
    companyId: row.company_id,
    enabled: row.enabled,
    mode: row.mode as AgentRunMode,
    autonomyMode: row.autonomy_mode as AutonomyMode,
    allowedTools: row.allowed_tools,
    maxRiskLevel: row.max_risk_level as AgentDefinition["maxRiskLevel"],
    defaultModelAlias: row.default_model_alias,
    disableAfterCurrentRun: row.disable_after_current_run,
  };
}

export async function getAgent(agentKey: string): Promise<AgentDefinition | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("agents").select("*").eq("agent_key", agentKey).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as AgentRow);
}

export async function listAgents(): Promise<AgentDefinition[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("agents").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as AgentRow[] | null ?? []).map(mapRow);
}
