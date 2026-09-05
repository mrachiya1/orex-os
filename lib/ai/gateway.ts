import "server-only";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { buildContext, type BuildContextParams } from "./context-builder";
import { routeAndCall } from "./router";
import { validateStructuredOutput, toJsonSchemaResponseFormat } from "./structured-output";
import { recordUsage } from "./usage";
import { isKnownTaskAlias } from "./model-registry";
import { AIGatewayError, type AIErrorCode } from "./errors";
import type { ChatMessage } from "./client";

export interface RequestAIParams<T> {
  alias: string;
  companyId: string;
  organisationId?: string | null;
  systemPrompt: string;
  userPrompt: string;
  context: BuildContextParams;
  schema?: z.ZodType<T>;
  schemaName?: string;
  promptVersion?: string;
}

export interface AIResult<T> {
  data: T;
  actualModel: string;
  provider: string | null;
  latencyMs: number;
}

/**
 * The single sanctioned entrypoint every future Orex OS AI feature calls.
 * See prompts/002-openrouter-gateway.md "Request Lifecycle". No caller-
 * supplied company id bypasses server-side company resolution or
 * permission checks -- identical rule to every Phase 001 server action.
 *
 * Records exactly one ai_usage_events row per call that reaches an
 * authenticated user (success or failure); a request with no verified
 * session is rejected before that point and produces no usage row, since
 * there is no real actor to attribute it to -- see
 * prompts/002-openrouter-gateway.md "Request Lifecycle".
 */
export async function requestAI<T = string>(params: RequestAIParams<T>): Promise<AIResult<T>> {
  const startedAt = Date.now();
  const user = await requireCurrentUser().catch(() => {
    throw new AIGatewayError("PERMISSION_DENIED", "Authentication is required to use AI features.");
  });

  let errorCode: AIErrorCode | null = null;
  let actualModel: string | null = null;
  let requestedModel: string | null = null;
  let provider: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let totalTokens: number | null = null;
  let estimatedCost: number | null = null;
  let aliasForUsage = params.alias;

  try {
    if (!isKnownTaskAlias(params.alias)) {
      throw new AIGatewayError("UNKNOWN_TASK_ALIAS", `Unknown AI task alias: ${params.alias}`);
    }
    const alias = params.alias;
    aliasForUsage = alias;

    const allowed = await hasPermission(params.companyId, PERMISSIONS.AI_USE);
    if (!allowed) {
      await writeAuditLog({
        actorUserId: user.id,
        companyId: params.companyId,
        organisationId: params.organisationId ?? null,
        resourceType: "ai_request",
        action: "ai_request.permission_denied",
        resultStatus: "failure",
        reason: `Missing ai.use permission for task alias ${alias}`,
      });
      throw new AIGatewayError(
        "PERMISSION_DENIED",
        "You do not have permission to use AI for this company."
      );
    }

    const built = buildContext(params.context);

    const messages: ChatMessage[] = [
      { role: "system", content: params.systemPrompt },
      {
        role: "user",
        content: `${params.userPrompt}\n\nContext:\n${JSON.stringify(built.redacted)}`,
      },
    ];

    const jsonSchema = params.schema
      ? toJsonSchemaResponseFormat(params.schemaName ?? "result", params.schema)
      : undefined;

    const callResult = await routeAndCall({
      alias,
      messages,
      classification: built.classification,
      jsonSchema,
    });

    requestedModel = callResult.requestedModel;
    actualModel = callResult.actualModel;
    provider = callResult.provider;
    inputTokens = callResult.inputTokens;
    outputTokens = callResult.outputTokens;
    totalTokens = callResult.totalTokens;
    estimatedCost = callResult.cost;

    const data = params.schema
      ? validateStructuredOutput(callResult.content, params.schema)
      : ((callResult.content as unknown) as T);

    return {
      data,
      actualModel: callResult.actualModel,
      provider: callResult.provider,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    errorCode = err instanceof AIGatewayError ? err.code : "INVALID_PROVIDER_RESPONSE";
    throw err instanceof AIGatewayError
      ? err
      : new AIGatewayError("INVALID_PROVIDER_RESPONSE", "The AI request failed unexpectedly.");
  } finally {
    await recordUsage({
      actorUserId: user.id,
      organisationId: params.organisationId ?? null,
      companyId: params.companyId,
      taskAlias: aliasForUsage,
      requestedModel,
      actualModel,
      provider,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      latencyMs: Date.now() - startedAt,
      resultStatus: errorCode ? "failure" : "success",
      promptVersion: params.promptVersion ?? null,
      errorClassification: errorCode,
    });
  }
}
