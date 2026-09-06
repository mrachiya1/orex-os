"use server";

import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/database/server";
import { listAgents as listAgentsFromRegistry, getAgent } from "@/lib/ai/agents/registry";
import { getGlobalAIControls, setGlobalAIControls } from "@/lib/ai/agents/global-controls";
import type { ActionResult } from "@/lib/actions/result";
import { toSafeAIErrorMessage } from "@/lib/ai/errors";

const setAgentEnabledSchema = z.object({
  companyId: z.string().uuid(),
  agentKey: z.string().min(1),
  enabled: z.boolean(),
});

const setAgentModeSchema = z.object({
  companyId: z.string().uuid(),
  agentKey: z.string().min(1),
  mode: z.enum(["OFF", "MANUAL", "SCHEDULED", "AUTO_SAFE"]),
});

const updateAgentBudgetSchema = z.object({
  companyId: z.string().uuid(),
  agentKey: z.string().min(1),
  dailyBudgetUsd: z.number().positive().nullable(),
  monthlyBudgetUsd: z.number().positive().nullable(),
  maxDailyRuns: z.number().int().positive().nullable(),
  maxContextTokens: z.number().int().positive().nullable(),
});

const setGlobalControlsSchema = z.object({
  companyId: z.string().uuid(),
  paused: z.boolean().optional(),
  backgroundAgentsEnabled: z.boolean().optional(),
  scheduledAgentsEnabled: z.boolean().optional(),
  autoSafeActionsEnabled: z.boolean().optional(),
});

/** Read-only -- gated on agents.read, matching this Control Room data's own RLS. */
export async function listAgents(companyId: string) {
  await requireCurrentUser();
  await requirePermission(companyId, PERMISSIONS.AGENTS_READ);
  return listAgentsFromRegistry();
}

export async function getGlobalControls(companyId: string) {
  await requireCurrentUser();
  await requirePermission(companyId, PERMISSIONS.AGENTS_READ);
  return getGlobalAIControls(companyId);
}

/**
 * Every mutation below requires agents.manage -- a Viewer (or anyone
 * without it) cannot enable/disable/reconfigure an agent, per
 * prompts/014-orex-intelligence.md "AGENT MANAGEMENT PERMISSIONS". Writes
 * go through the service-role client since `agents` has no client-facing
 * UPDATE policy (mirrors ai_action_requests' pattern) -- this function is
 * the one place that check is enforced before the write happens.
 */
export async function setAgentEnabled(input: unknown): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    const parsed = setAgentEnabledSchema.parse(input);
    const user = await requireCurrentUser();
    await requirePermission(parsed.companyId, PERMISSIONS.AGENTS_ENABLE);

    const service = createServiceRoleClient();
    const { data: agent, error: findError } = await service
      .from("agents")
      .select("id, organisation_id, company_id, enabled, mode")
      .eq("agent_key", parsed.agentKey)
      .maybeSingle();
    if (findError) return { ok: false, error: "Something went wrong. Please try again." };
    if (!agent) return { ok: false, error: "Agent not found." };

    const { error } = await service.from("agents").update({ enabled: parsed.enabled, updated_at: new Date().toISOString() }).eq("id", agent.id);
    if (error) return { ok: false, error: "Something went wrong. Please try again." };

    await writeAuditLog({
      actorUserId: user.id,
      organisationId: agent.organisation_id,
      companyId: parsed.companyId,
      resourceType: "agents",
      resourceId: agent.id,
      action: parsed.enabled ? "agent.enabled" : "agent.disabled",
      beforeState: { enabled: agent.enabled, mode: agent.mode },
      afterState: { enabled: parsed.enabled, mode: agent.mode },
    });

    return { ok: true, enabled: parsed.enabled };
  } catch (err) {
    console.error("setAgentEnabled failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

export async function setAgentMode(input: unknown): Promise<ActionResult<{ mode: string }>> {
  try {
    const parsed = setAgentModeSchema.parse(input);
    const user = await requireCurrentUser();
    await requirePermission(parsed.companyId, PERMISSIONS.AGENTS_MANAGE);

    const service = createServiceRoleClient();
    const { data: agent, error: findError } = await service
      .from("agents")
      .select("id, organisation_id, enabled, mode")
      .eq("agent_key", parsed.agentKey)
      .maybeSingle();
    if (findError) return { ok: false, error: "Something went wrong. Please try again." };
    if (!agent) return { ok: false, error: "Agent not found." };

    const { error } = await service.from("agents").update({ mode: parsed.mode, updated_at: new Date().toISOString() }).eq("id", agent.id);
    if (error) return { ok: false, error: "Something went wrong. Please try again." };

    await writeAuditLog({
      actorUserId: user.id,
      organisationId: agent.organisation_id,
      companyId: parsed.companyId,
      resourceType: "agents",
      resourceId: agent.id,
      action: "agent.mode_changed",
      beforeState: { enabled: agent.enabled, mode: agent.mode },
      afterState: { enabled: agent.enabled, mode: parsed.mode },
    });

    return { ok: true, mode: parsed.mode };
  } catch (err) {
    console.error("setAgentMode failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

export async function updateAgentBudget(input: unknown): Promise<ActionResult<object>> {
  try {
    const parsed = updateAgentBudgetSchema.parse(input);
    const user = await requireCurrentUser();
    await requirePermission(parsed.companyId, PERMISSIONS.AGENTS_MANAGE);

    const service = createServiceRoleClient();
    const { data: agent, error: findError } = await service
      .from("agents")
      .select("id, organisation_id")
      .eq("agent_key", parsed.agentKey)
      .maybeSingle();
    if (findError) return { ok: false, error: "Something went wrong. Please try again." };
    if (!agent) return { ok: false, error: "Agent not found." };

    const { error } = await service.from("agent_budgets").upsert(
      {
        agent_id: agent.id,
        daily_budget_usd: parsed.dailyBudgetUsd,
        monthly_budget_usd: parsed.monthlyBudgetUsd,
        max_daily_runs: parsed.maxDailyRuns,
        max_context_tokens: parsed.maxContextTokens,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" }
    );
    if (error) return { ok: false, error: "Something went wrong. Please try again." };

    await writeAuditLog({
      actorUserId: user.id,
      organisationId: agent.organisation_id,
      companyId: parsed.companyId,
      resourceType: "agent_budgets",
      resourceId: agent.id,
      action: "agent.budget_updated",
      afterState: {
        dailyBudgetUsd: parsed.dailyBudgetUsd,
        monthlyBudgetUsd: parsed.monthlyBudgetUsd,
        maxDailyRuns: parsed.maxDailyRuns,
        maxContextTokens: parsed.maxContextTokens,
      },
    });

    return { ok: true };
  } catch (err) {
    console.error("updateAgentBudget failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

/** "Pause All Agents" and the other per-company global switches. */
export async function updateGlobalControls(input: unknown): Promise<ActionResult<object>> {
  try {
    const parsed = setGlobalControlsSchema.parse(input);
    const user = await requireCurrentUser();
    await requirePermission(parsed.companyId, PERMISSIONS.AGENTS_MANAGE);

    await setGlobalAIControls(parsed.companyId, user.id, {
      paused: parsed.paused,
      backgroundAgentsEnabled: parsed.backgroundAgentsEnabled,
      scheduledAgentsEnabled: parsed.scheduledAgentsEnabled,
      autoSafeActionsEnabled: parsed.autoSafeActionsEnabled,
    });

    await writeAuditLog({
      actorUserId: user.id,
      companyId: parsed.companyId,
      resourceType: "global_ai_controls",
      action: "global_ai_controls.updated",
      afterState: parsed,
    });

    return { ok: true };
  } catch (err) {
    console.error("updateGlobalControls failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

/**
 * Control Room summary. "Currently Running" and "Scheduled" are
 * deliberately omitted -- executeTool does not yet write to agent_runs
 * (schedules/events are explicitly deferred this pass), so those counts
 * would be fabricated rather than real; ai_action_requests' `proposed`
 * status is a real, honest proxy for "waiting approval" today.
 */
export async function getControlRoomSummary(companyId: string) {
  await requireCurrentUser();
  await requirePermission(companyId, PERMISSIONS.AGENTS_READ);

  const supabase = await createServerSupabaseClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [agents, { count: waitingApproval }, { data: dayRows }, { data: monthRows }, { count: failedRecently }] =
    await Promise.all([
      listAgentsFromRegistry(),
      supabase
        .from("ai_action_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "proposed"),
      supabase.from("ai_usage_events").select("estimated_cost").eq("company_id", companyId).gte("created_at", startOfDay.toISOString()),
      supabase.from("ai_usage_events").select("estimated_cost").eq("company_id", companyId).gte("created_at", startOfMonth.toISOString()),
      supabase
        .from("ai_action_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "failed"),
    ]);

  const sum = (rows: Array<{ estimated_cost: number | null }> | null) =>
    (rows ?? []).reduce((total, r) => total + (r.estimated_cost ?? 0), 0);

  return {
    agentsEnabled: agents.filter((a) => a.enabled).length,
    agentsDisabled: agents.filter((a) => !a.enabled).length,
    waitingApproval: waitingApproval ?? 0,
    failedRecently: failedRecently ?? 0,
    spendToday: sum(dayRows),
    spendMonth: sum(monthRows),
  };
}

/** Real recent tool activity for the Intelligence workspace's Recent Activity panel -- never fabricated. */
export interface RecentActivityRow {
  id: string;
  toolName: string;
  status: string;
  createdAt: string;
}

export async function getRecentActivity(companyId: string, limit = 5): Promise<RecentActivityRow[]> {
  await requireCurrentUser();
  await requirePermission(companyId, PERMISSIONS.AGENTS_READ);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_action_requests")
    .select("id, tool_name, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => ({ id: r.id, toolName: r.tool_name, status: r.status, createdAt: r.created_at }));
}

/** Exposed for Control Room cost cards -- reuses ai_usage_events, never a duplicate ledger. */
export async function getAgentSpend(companyId: string, agentKey: string) {
  await requireCurrentUser();
  await requirePermission(companyId, PERMISSIONS.AGENTS_READ);

  const agent = await getAgent(agentKey);
  if (!agent) return { today: 0, month: 0 };

  const supabase = await createServerSupabaseClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ data: dayRows }, { data: monthRows }] = await Promise.all([
    supabase.from("ai_usage_events").select("estimated_cost").eq("agent_id", agent.id).gte("created_at", startOfDay.toISOString()),
    supabase.from("ai_usage_events").select("estimated_cost").eq("agent_id", agent.id).gte("created_at", startOfMonth.toISOString()),
  ]);

  const sum = (rows: Array<{ estimated_cost: number | null }> | null) =>
    (rows ?? []).reduce((total, r) => total + (r.estimated_cost ?? 0), 0);

  return { today: sum(dayRows), month: sum(monthRows) };
}
