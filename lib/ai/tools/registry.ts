import { projectsTools } from "./projects";
import type { AnyToolDefinition } from "./types";

export type { AnyToolDefinition };

/**
 * The single allowlist. A tool name not present here cannot be invoked by
 * any code path -- there is no fallback, no dynamic lookup, no way for a
 * model's output to reach a handler it doesn't name exactly. Add new
 * domain tool files here as they're built (knowledge.ts, decisions.ts,
 * team.ts, delivery.ts, ...) -- never register a tool for an entity that
 * doesn't have a real, already-existing server action behind it.
 */
export const TOOL_REGISTRY: Record<string, AnyToolDefinition> = {
  ...(projectsTools as unknown as Record<string, AnyToolDefinition>),
};

export function getTool(name: string): AnyToolDefinition | undefined {
  return TOOL_REGISTRY[name];
}

export function listToolsForAgent(allowedToolNames: readonly string[]) {
  return allowedToolNames
    .map((name) => TOOL_REGISTRY[name])
    .filter((tool): tool is AnyToolDefinition => Boolean(tool));
}

const RISK_LABELS = ["Read Only", "Safe", "Important", "Critical"] as const;

/** The real registered risk level for a tool (prompts/013 LEVEL 0-3) -- never a per-request guess. */
export function getToolRiskLabel(toolName: string): (typeof RISK_LABELS)[number] | null {
  const tool = getTool(toolName);
  return tool ? RISK_LABELS[tool.riskLevel] : null;
}
