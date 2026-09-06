import type { AutonomyMode, RiskLevel } from "./types";

/**
 * LEVEL 2+ ("important update", "high risk") require explicit confirmation
 * by default; LEVEL 0-1 ("read only", "safe update") may execute
 * immediately, subject to the agent's own autonomy mode (see
 * isExecutionAllowed below, which is the actual gate the executor uses --
 * this function only expresses the tool's own baseline).
 */
export function requiresApprovalByDefault(risk: RiskLevel): boolean {
  return risk >= 2;
}

/**
 * The executor's real policy gate: an agent's configured autonomy mode is
 * always an ADDITIONAL ceiling on top of the tool's own risk default, never
 * a way to loosen it (prompts/013-ai-action-engine.md Decisions #6).
 *
 * - READ_ONLY: only risk 0 tools may ever execute; anything else is refused
 *   outright (not even proposed -- there is nothing to approve into, since
 *   this agent is never allowed to mutate).
 * - SUGGEST_ONLY: never auto-executes anything above risk 0; always
 *   proposes for a human to act on directly (not even via this agent's own
 *   approval flow -- SUGGEST_ONLY agents don't execute at all once
 *   approved elsewhere in this pass; see AgentDefinition doc comments).
 * - CONFIRM_TO_ACT: risk 0 may execute immediately; anything above always
 *   requires confirmation, regardless of the tool's own default.
 * - AUTO_SAFE: risk 0-1 may execute immediately (matches the tool's own
 *   default); risk 2+ still requires confirmation.
 */
export function isExecutionAllowed(autonomyMode: AutonomyMode, risk: RiskLevel): "execute" | "propose" | "refuse" {
  if (autonomyMode === "READ_ONLY") {
    return risk === 0 ? "execute" : "refuse";
  }
  if (autonomyMode === "SUGGEST_ONLY") {
    return risk === 0 ? "execute" : "propose";
  }
  if (autonomyMode === "CONFIRM_TO_ACT") {
    return risk === 0 ? "execute" : "propose";
  }
  // AUTO_SAFE
  return risk <= 1 ? "execute" : "propose";
}
