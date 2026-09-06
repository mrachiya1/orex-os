import type { AgentDefinition } from "@/lib/ai/tools/types";

/**
 * Static, typed configuration -- not a database table (prompts/013-ai-
 * action-engine.md Decisions #4: "smallest maintainable architecture" for
 * this pass). Revisit as a DB table only if/when agents need to be edited
 * without a deploy.
 *
 * Only one agent is configured this pass, matching the two Tier-1 tools
 * that exist (lib/ai/tools/projects.ts). `maxRiskLevel` is set to what's
 * actually registered and usable today -- raise it deliberately, alongside
 * adding real higher-risk tools, never speculatively.
 */
export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  advisor: {
    agentId: "advisor",
    name: "Company Brain Advisor",
    description: "Answers questions and performs simple, confirmed project actions on the user's behalf.",
    autonomyMode: "CONFIRM_TO_ACT",
    allowedTools: ["projects.search", "projects.task.create"],
    maxRiskLevel: 1,
  },
};

export function getAgent(agentId: string): AgentDefinition | undefined {
  return AGENT_REGISTRY[agentId];
}
