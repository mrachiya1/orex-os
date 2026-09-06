import "server-only";
import { createServiceRoleClient } from "@/lib/database/server";

/**
 * Budget enforcement reads straight from ai_usage_events -- the existing,
 * single source of AI cost/usage truth (lib/ai/usage.ts) -- never a
 * separate counter that could drift from it. Uses the service-role client
 * because this is an internal integrity check made mid-executeTool, not a
 * user-facing read (a user viewing their own agent's spend goes through
 * the normal RLS-scoped read path instead, e.g. a future Control Room
 * query).
 */

export interface AgentBudget {
  dailyBudgetUsd: number | null;
  monthlyBudgetUsd: number | null;
  maxDailyRuns: number | null;
  maxContextTokens: number | null;
}

interface AgentBudgetRow {
  daily_budget_usd: number | null;
  monthly_budget_usd: number | null;
  max_daily_runs: number | null;
  max_context_tokens: number | null;
}

export async function getAgentBudget(agentId: string): Promise<AgentBudget | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("agent_budgets")
    .select("daily_budget_usd, monthly_budget_usd, max_daily_runs, max_context_tokens")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as AgentBudgetRow;
  return {
    dailyBudgetUsd: row.daily_budget_usd,
    monthlyBudgetUsd: row.monthly_budget_usd,
    maxDailyRuns: row.max_daily_runs,
    maxContextTokens: row.max_context_tokens,
  };
}

function startOfDayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export type BudgetCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * No budget configured for an agent means unlimited -- a budget row is
 * opt-in, never a silent default cap. Never exceeds a configured hard
 * budget automatically: this is checked BEFORE a call is allowed to
 * proceed, not corrected after the fact.
 */
export async function checkBudgetRemaining(agentId: string): Promise<BudgetCheckResult> {
  const budget = await getAgentBudget(agentId);
  if (!budget) return { ok: true };

  const service = createServiceRoleClient();

  if (budget.dailyBudgetUsd !== null || budget.maxDailyRuns !== null) {
    const { data, error } = await service
      .from("ai_usage_events")
      .select("estimated_cost")
      .eq("agent_id", agentId)
      .gte("created_at", startOfDayIso());
    if (error) throw new Error(error.message);
    const rows = (data as Array<{ estimated_cost: number | null }> | null) ?? [];

    if (budget.maxDailyRuns !== null && rows.length >= budget.maxDailyRuns) {
      return { ok: false, reason: "This agent has reached its maximum runs for today." };
    }
    if (budget.dailyBudgetUsd !== null) {
      const spent = rows.reduce((sum, r) => sum + (r.estimated_cost ?? 0), 0);
      if (spent >= budget.dailyBudgetUsd) {
        return { ok: false, reason: "This agent has reached its daily budget." };
      }
    }
  }

  if (budget.monthlyBudgetUsd !== null) {
    const { data, error } = await service
      .from("ai_usage_events")
      .select("estimated_cost")
      .eq("agent_id", agentId)
      .gte("created_at", startOfMonthIso());
    if (error) throw new Error(error.message);
    const spent = ((data as Array<{ estimated_cost: number | null }> | null) ?? []).reduce(
      (sum, r) => sum + (r.estimated_cost ?? 0),
      0
    );
    if (spent >= budget.monthlyBudgetUsd) {
      return { ok: false, reason: "This agent has reached its monthly budget." };
    }
  }

  return { ok: true };
}
