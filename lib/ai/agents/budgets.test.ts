import { describe, it, expect, vi, beforeEach } from "vitest";

function mockChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte"]) {
    chain[m] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (resolve: (v: typeof result) => void) => resolve(result);
  return chain;
}

let fromResponses: Record<string, { data: unknown; error: { message: string } | null }> = {};
vi.mock("@/lib/database/server", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => mockChain(fromResponses[table] ?? { data: null, error: null }),
  }),
}));

const { checkBudgetRemaining } = await import("./budgets");

describe("checkBudgetRemaining", () => {
  beforeEach(() => {
    fromResponses = {};
  });

  it("allows unlimited runs when no budget row is configured", async () => {
    fromResponses.agent_budgets = { data: null, error: null };
    const result = await checkBudgetRemaining("agent-1");
    expect(result.ok).toBe(true);
  });

  it("blocks once the daily budget is spent", async () => {
    fromResponses.agent_budgets = {
      data: { daily_budget_usd: 5, monthly_budget_usd: null, max_daily_runs: null, max_context_tokens: null },
      error: null,
    };
    fromResponses.ai_usage_events = { data: [{ estimated_cost: 3 }, { estimated_cost: 3 }], error: null };
    const result = await checkBudgetRemaining("agent-1");
    expect(result.ok).toBe(false);
  });

  it("allows a run when spend is below the daily budget", async () => {
    fromResponses.agent_budgets = {
      data: { daily_budget_usd: 5, monthly_budget_usd: null, max_daily_runs: null, max_context_tokens: null },
      error: null,
    };
    fromResponses.ai_usage_events = { data: [{ estimated_cost: 1 }], error: null };
    const result = await checkBudgetRemaining("agent-1");
    expect(result.ok).toBe(true);
  });

  it("blocks once the max daily run count is reached", async () => {
    fromResponses.agent_budgets = {
      data: { daily_budget_usd: null, monthly_budget_usd: null, max_daily_runs: 2, max_context_tokens: null },
      error: null,
    };
    fromResponses.ai_usage_events = { data: [{ estimated_cost: 0 }, { estimated_cost: 0 }], error: null };
    const result = await checkBudgetRemaining("agent-1");
    expect(result.ok).toBe(false);
  });

  it("blocks once the monthly budget is spent", async () => {
    fromResponses.agent_budgets = {
      data: { daily_budget_usd: null, monthly_budget_usd: 10, max_daily_runs: null, max_context_tokens: null },
      error: null,
    };
    fromResponses.ai_usage_events = { data: [{ estimated_cost: 12 }], error: null };
    const result = await checkBudgetRemaining("agent-1");
    expect(result.ok).toBe(false);
  });

  it("never exceeds a configured hard budget automatically -- spend exactly at the limit still blocks", async () => {
    fromResponses.agent_budgets = {
      data: { daily_budget_usd: 5, monthly_budget_usd: null, max_daily_runs: null, max_context_tokens: null },
      error: null,
    };
    fromResponses.ai_usage_events = { data: [{ estimated_cost: 5 }], error: null };
    const result = await checkBudgetRemaining("agent-1");
    expect(result.ok).toBe(false);
  });
});
