/**
 * Tool-call *parsing* foundation only -- Phase 002 registers no real tools
 * and grants no execution/database access from AI output. See
 * docs/ai/ai-action-policy.md and .agents/skills/orex-safe-ai-actions/SKILL.md
 * for the (future-phase) architecture any real tool must follow.
 */
export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/** Recognizes a tool-call-shaped model response without executing anything. */
export function parseToolCallResponse(raw: unknown): ToolCallRequest | null {
  if (
    raw &&
    typeof raw === "object" &&
    "name" in raw &&
    typeof (raw as { name: unknown }).name === "string" &&
    "arguments" in raw &&
    typeof (raw as { arguments: unknown }).arguments === "object"
  ) {
    return {
      name: (raw as { name: string }).name,
      arguments: (raw as { arguments: Record<string, unknown> }).arguments,
    };
  }
  return null;
}
