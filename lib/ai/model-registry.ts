/**
 * Task alias registry -- the only place a real OpenRouter model id may
 * appear. Feature code requests an alias (e.g. "advisor.deep"); it never
 * references a model id directly. See docs/ai/model-routing.md.
 *
 * Model ids below are PROPOSED configuration (per the founder's Phase 002
 * approval decisions), not permanent architecture -- changing them is a
 * config edit, never a feature-code change.
 */
import "server-only";

export type TaskAlias =
  | "advisor.deep"
  | "ops.fast"
  | "finance.structured"
  | "risk.deep"
  | "meeting.research"
  | "builder.long"
  | "knowledge.extract"
  | "agent.tools";

export type SensitivityAllowance = "public_internal" | "confidential" | "restricted";

export interface ModelRouteConfig {
  primaryModel: string;
  fallbackModels: string[];
  requiresStructuredOutput: boolean;
  requiresTools: boolean;
  sensitivityAllowance: SensitivityAllowance;
}

/**
 * Last-resort safety-net model, used only if an alias's own fallback chain
 * is exhausted AND the registry entry itself is somehow missing/misconfigured.
 * Repurposes the Phase 001-reserved OPENROUTER_DEFAULT_MODEL env var.
 */
export function getDefaultFallbackModel(): string | undefined {
  return process.env.OPENROUTER_DEFAULT_MODEL || undefined;
}

export const MODEL_REGISTRY: Record<TaskAlias, ModelRouteConfig> = {
  "ops.fast": {
    primaryModel: "openai/gpt-5.4-mini",
    fallbackModels: [],
    requiresStructuredOutput: false,
    requiresTools: false,
    sensitivityAllowance: "public_internal",
  },
  "knowledge.extract": {
    primaryModel: "openai/gpt-5.4-mini",
    fallbackModels: [],
    requiresStructuredOutput: true,
    requiresTools: false,
    sensitivityAllowance: "public_internal",
  },
  "finance.structured": {
    primaryModel: "openai/gpt-5.4-mini",
    // Cross-family fallback (Anthropic) rather than a second OpenAI model,
    // so a single provider/family outage doesn't take out both attempts --
    // acceptable for this alias since claude-sonnet-4.6 also satisfies its
    // structured-output requirement.
    fallbackModels: ["anthropic/claude-sonnet-4.6"],
    requiresStructuredOutput: true,
    requiresTools: false,
    sensitivityAllowance: "restricted",
  },
  "advisor.deep": {
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: [],
    requiresStructuredOutput: true,
    requiresTools: false,
    sensitivityAllowance: "confidential",
  },
  "risk.deep": {
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: [],
    requiresStructuredOutput: true,
    requiresTools: false,
    sensitivityAllowance: "confidential",
  },
  "builder.long": {
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: [],
    requiresStructuredOutput: false,
    requiresTools: false,
    sensitivityAllowance: "confidential",
  },
  // Defined per the founder's decision but deliberately not wired to any
  // real feature yet -- kept minimal (single/no fallback) rather than
  // overbuilding a registry entry for a capability nothing uses.
  "meeting.research": {
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: [],
    requiresStructuredOutput: true,
    requiresTools: false,
    sensitivityAllowance: "confidential",
  },
  "agent.tools": {
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: [],
    requiresStructuredOutput: true,
    requiresTools: true,
    sensitivityAllowance: "restricted",
  },
};

export function isKnownTaskAlias(value: string): value is TaskAlias {
  return Object.prototype.hasOwnProperty.call(MODEL_REGISTRY, value);
}

export function getModelRoute(alias: TaskAlias): ModelRouteConfig {
  return MODEL_REGISTRY[alias];
}
