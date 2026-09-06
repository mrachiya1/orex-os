import "server-only";
import { createServiceRoleClient } from "@/lib/database/server";
import type { AIErrorCode } from "./errors";

export interface UsageEventInput {
  actorUserId: string | null;
  organisationId?: string | null;
  companyId?: string | null;
  /** agents.id (uuid), when this call was made on behalf of a configured agent -- powers Control Room cost rollups (prompts/014-orex-intelligence.md); never a second accounting table. */
  agentId?: string | null;
  /** agent_runs.id (uuid), when this call is part of a tracked run. */
  agentRunId?: string | null;
  /** The requested alias string, even if unknown/invalid -- useful for debugging bad callers. */
  taskAlias: string;
  requestedModel: string | null;
  actualModel: string | null;
  provider: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
  latencyMs: number;
  resultStatus: "success" | "failure";
  promptVersion?: string | null;
  errorClassification?: AIErrorCode | null;
}

/**
 * Writes one ai_usage_events row per gateway call, success or failure.
 * Uses the service-role client because the table has no client-facing
 * INSERT policy -- same write-protection pattern as lib/audit. Never
 * receives or stores raw prompt/response content (see
 * prompts/002-openrouter-gateway.md "Usage/Cost Tracking").
 */
export async function recordUsage(event: UsageEventInput): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from("ai_usage_events").insert({
    actor_user_id: event.actorUserId,
    organisation_id: event.organisationId ?? null,
    company_id: event.companyId ?? null,
    agent_id: event.agentId ?? null,
    agent_run_id: event.agentRunId ?? null,
    task_alias: event.taskAlias,
    requested_model: event.requestedModel,
    actual_model: event.actualModel,
    provider: event.provider,
    input_tokens: event.inputTokens,
    output_tokens: event.outputTokens,
    total_tokens: event.totalTokens,
    estimated_cost: event.estimatedCost,
    latency_ms: event.latencyMs,
    result_status: event.resultStatus,
    prompt_version: event.promptVersion ?? null,
    error_classification: event.errorClassification ?? null,
  });

  if (error) {
    // Never let a usage-write failure block the caller's already-resolved
    // AI result from returning -- same discipline as lib/audit.
    console.error("Failed to write ai_usage_events row", {
      taskAlias: event.taskAlias,
      message: error.message,
    });
  }
}
