import { z } from "zod";
import { AIGatewayError } from "@/lib/ai/errors";

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
 *
 * This is the semantic, app-facing shape -- used for the FINAL validation
 * (toAgentCommandResult below) and as the TypeScript type everywhere else
 * in the codebase. It is NOT sent to OpenRouter directly: a Zod
 * discriminated union converts to a root-level `oneOf`/`anyOf` JSON Schema
 * (verified via z.toJSONSchema), which OpenAI-family strict structured
 * outputs (used by both openai/gpt-5-mini and, via OpenRouter's
 * normalization, other providers routed through the same response_format
 * path) do not support at the schema root -- only `type: "object"` is
 * allowed there. Sending this schema as-is caused the provider to ignore
 * strict enforcement and return free-text that failed JSON.parse (the
 * "model's response was not valid JSON" incident). See
 * agentCommandWireSchema below for the schema actually sent to the model.
 */
/** Mirrors MAX_BATCH_TASK_COUNT (lib/validation/projects.ts) -- kept as a literal here rather than imported so this schema file has no dependency on project validation internals; the real enforcement is projects.tasks.create_batch's own input schema, this is just the model-facing ceiling. */
const MAX_BATCH_TASKS = 50;

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
  /**
   * A pasted checklist/multiple distinct tasks in one message (production
   * failure fix). Never executed directly -- runCompanyBrainCommand still
   * resolves projectNameHint deterministically via projects.search and
   * routes the mutation through executeTool/projects.tasks.create_batch,
   * exactly like the single tool_call variant. Capped here so an
   * over-length model response fails validation (a clear, safe error)
   * rather than silently creating an unbounded number of rows.
   */
  z.object({
    kind: z.literal("batch_task_import"),
    projectNameHint: z.string().min(1).max(200),
    tasks: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
          dueDate: z.string().optional(),
        })
      )
      .min(1)
      .max(MAX_BATCH_TASKS),
  }),
]);

export type AgentCommandResult = z.infer<typeof agentCommandSchema>;

/**
 * The schema actually sent to OpenRouter as response_format.json_schema.
 * A single flat object at the root (never a union) with every field from
 * every variant present -- fields that only apply to some `kind` values
 * are `.nullable()`, never `.optional()`, because OpenAI-family strict
 * mode requires every property to appear in `required`; an "optional"
 * field must instead be typed to allow `null` and always be present in
 * the response (see OpenAI's structured-outputs strict-mode docs). This
 * is the "normalize optional fields deliberately" step -- never weaken
 * this into a plain non-strict schema instead.
 */
export const agentCommandWireSchema = z.object({
  kind: z.enum(["answer", "tool_call", "needs_clarification", "batch_task_import"]),
  answer: z.string().nullable(),
  citedSources: z.array(z.object({ knowledgeItemId: z.string(), title: z.string() })).nullable(),
  tool: z.literal("projects.task.create").nullable(),
  projectNameHint: z.string().nullable(),
  title: z.string().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).nullable(),
  dueDate: z.string().nullable(),
  question: z.string().nullable(),
  // batch_task_import only. Each item's own priority/dueDate stay nullable
  // (not optional) for the same OpenAI strict-mode reason as the top level.
  tasks: z
    .array(
      z.object({
        title: z.string(),
        priority: z.enum(["low", "normal", "high", "urgent"]).nullable(),
        dueDate: z.string().nullable(),
      })
    )
    .nullable(),
});

export type AgentCommandWire = z.infer<typeof agentCommandWireSchema>;

/**
 * Maps the flat wire shape (validated only against agentCommandWireSchema
 * by lib/ai/gateway.ts -- a shape check, not a semantic one) into the real
 * semantic discriminated union, and validates it there. This is where "the
 * model said kind=answer but didn't actually provide an answer" (a null
 * `answer` field) gets caught -- exactly as strictly as a single combined
 * schema would have, before this split existed. Never weakens validation;
 * only splits it across the wire-shape and semantic-shape boundary.
 */
export function toAgentCommandResult(wire: AgentCommandWire): AgentCommandResult {
  const candidate =
    wire.kind === "answer"
      ? { kind: "answer" as const, answer: wire.answer, citedSources: wire.citedSources ?? [] }
      : wire.kind === "tool_call"
        ? {
            kind: "tool_call" as const,
            tool: wire.tool,
            projectNameHint: wire.projectNameHint,
            title: wire.title,
            priority: wire.priority ?? undefined,
            dueDate: wire.dueDate ?? undefined,
          }
        : wire.kind === "batch_task_import"
          ? {
              kind: "batch_task_import" as const,
              projectNameHint: wire.projectNameHint,
              tasks: (wire.tasks ?? []).map((t) => ({
                title: t.title,
                priority: t.priority ?? undefined,
                dueDate: t.dueDate ?? undefined,
              })),
            }
          : { kind: "needs_clarification" as const, question: wire.question };

  const result = agentCommandSchema.safeParse(candidate);
  if (!result.success) {
    throw new AIGatewayError(
      "INVALID_STRUCTURED_OUTPUT",
      "The model's response did not match the expected schema."
    );
  }
  return result.data;
}
