import "server-only";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/database/server";

/**
 * Per-company global AI controls (founder-confirmed: Orextic and Orex
 * Studios manage this independently -- never a single org-wide switch).
 * An org-wide agent invocation (company_id null on the agent, but the
 * actual tool call always resolves a concrete company via its own scope)
 * is checked against THAT invocation's company, never the agent's own
 * company_id.
 */

export interface GlobalAIControls {
  paused: boolean;
  backgroundAgentsEnabled: boolean;
  scheduledAgentsEnabled: boolean;
  autoSafeActionsEnabled: boolean;
}

const DEFAULT_CONTROLS: GlobalAIControls = {
  paused: false,
  backgroundAgentsEnabled: true,
  scheduledAgentsEnabled: true,
  autoSafeActionsEnabled: true,
};

interface GlobalAIControlsRow {
  paused: boolean;
  background_agents_enabled: boolean;
  scheduled_agents_enabled: boolean;
  auto_safe_actions_enabled: boolean;
}

/**
 * No row for a company means the defaults above (never paused) -- a row
 * is only created the first time someone actually touches these controls
 * for that company.
 */
export async function getGlobalAIControls(companyId: string): Promise<GlobalAIControls> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("global_ai_controls")
    .select("paused, background_agents_enabled, scheduled_agents_enabled, auto_safe_actions_enabled")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_CONTROLS;
  const row = data as GlobalAIControlsRow;
  return {
    paused: row.paused,
    backgroundAgentsEnabled: row.background_agents_enabled,
    scheduledAgentsEnabled: row.scheduled_agents_enabled,
    autoSafeActionsEnabled: row.auto_safe_actions_enabled,
  };
}

export async function setGlobalAIControls(
  companyId: string,
  updatedBy: string,
  patch: Partial<GlobalAIControls>
): Promise<void> {
  const service = createServiceRoleClient();
  const current = await getGlobalAIControls(companyId);
  const next = { ...current, ...patch };
  const { error } = await service.from("global_ai_controls").upsert(
    {
      company_id: companyId,
      paused: next.paused,
      background_agents_enabled: next.backgroundAgentsEnabled,
      scheduled_agents_enabled: next.scheduledAgentsEnabled,
      auto_safe_actions_enabled: next.autoSafeActionsEnabled,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" }
  );
  if (error) throw new Error(error.message);
}
