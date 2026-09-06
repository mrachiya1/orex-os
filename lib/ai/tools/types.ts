import type { z } from "zod";
import type { PermissionKey } from "@/lib/permissions";

/**
 * LEVEL 0-3 from prompts/013-ai-action-engine.md. LEVEL 4 ("forbidden to
 * AI") deliberately has no representation here -- there is no tool to
 * forbid, because a level-4 action is simply never registered as a
 * ToolDefinition. The registry is an allowlist, not a blocklist.
 */
export type RiskLevel = 0 | 1 | 2 | 3;

export type AutonomyMode = "READ_ONLY" | "SUGGEST_ONLY" | "CONFIRM_TO_ACT" | "AUTO_SAFE";

/**
 * Everything a tool handler is allowed to know about who is calling it.
 * Deliberately minimal -- no session, no raw request, no tokens. `agentId`
 * is metadata (which configured agent made this call on the user's
 * behalf); it grants nothing by itself -- every real authorization check
 * is against `userId`'s own permissions (lib/ai/tools/authorization.ts).
 */
export interface ActorContext {
  userId: string;
  agentId: string;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  domain: string;
  requiredPermission: PermissionKey;
  /**
   * How authorization is resolved: "project" checks hasProjectAccess
   * (deriving company/org from the project row itself, never from
   * caller-supplied input); "company"/"organisation" check
   * hasPermission/hasOrgPermission against an id present on the parsed
   * input (see authorization.ts for the exact field each scope type reads).
   */
  scopeType: "organisation" | "company" | "project";
  riskLevel: RiskLevel;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput, actor: ActorContext) => Promise<TOutput>;
}

/**
 * The type-erased shape used for anything holding a heterogeneous mix of
 * tools (the registry, the executor) -- a concrete ToolDefinition<X,Y> is
 * still fully typed where it's declared (see lib/ai/tools/projects.ts);
 * only shared storage/lookup code uses this. `never` as the input
 * parameter type is deliberate (not `any`): call sites that actually
 * invoke `handler` cast the runtime-Zod-validated input with a single
 * `as never`, rather than disabling type checking everywhere this type
 * appears.
 */
export type AnyToolDefinition = ToolDefinition<never, unknown>;

/** OFF/MANUAL/SCHEDULED/AUTO_SAFE -- when an agent may run at all (prompts/014-orex-intelligence.md). Orthogonal to AutonomyMode, which governs whether a given tool call executes or proposes once the agent is already allowed to run. */
export type AgentRunMode = "OFF" | "MANUAL" | "SCHEDULED" | "AUTO_SAFE";

export interface AgentDefinition {
  /** DB primary key (agents.id) -- needed for budget/run-history lookups. */
  id: string;
  /** Stable string key used everywhere in application code (e.g. "advisor") -- what executeTool's agentId parameter is. */
  agentId: string;
  name: string;
  description: string;
  organisationId: string;
  companyId: string | null;
  enabled: boolean;
  mode: AgentRunMode;
  autonomyMode: AutonomyMode;
  allowedTools: readonly string[];
  maxRiskLevel: RiskLevel;
  defaultModelAlias: string;
  disableAfterCurrentRun: boolean;
}
