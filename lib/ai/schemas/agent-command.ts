import { z } from "zod";

/**
 * Structured output for the Company Brain "ask or command" input
 * (prompts/013-ai-action-engine.md Tier 2). Deliberately narrow: exactly
 * one command shape exists because exactly one mutation tool is registered
 * this pass (projects.task.create, lib/ai/tools/projects.ts). Generalize
 * this to a registry-driven union only once a second command-capable tool
 * actually exists -- building that abstraction for one case would be
 * premature.
 *
 * The model never receives or invents a resolved projectId -- it names the
 * project in `projectNameHint` (whatever text the user used), which the
 * server then resolves via the real projects.search tool (deterministic,
 * permission-scoped, never guessed) before proposing the mutation. See
 * "ID RESOLUTION" in the architecture prompt.
 */
export const agentCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("answer"),
    answer: z.string().min(1),
    citedSources: z.array(z.object({ knowledgeItemId: z.string().uuid(), title: z.string() })),
  }),
  z.object({
    kind: z.literal("tool_call"),
    tool: z.literal("projects.task.create"),
    projectNameHint: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    dueDate: z.string().optional(),
  }),
  z.object({
    kind: z.literal("needs_clarification"),
    question: z.string().min(1).max(500),
  }),
]);

export type AgentCommandResult = z.infer<typeof agentCommandSchema>;
