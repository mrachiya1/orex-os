import "server-only";
import { sendChatCompletion, type ChatMessage, type ChatCompletionResult } from "./client";
import { getModelRoute, getDefaultFallbackModel, type TaskAlias } from "./model-registry";
import { buildProviderPreferences } from "./privacy";
import { assertClassificationAllowed } from "./sensitivity";
import type { DataClassification } from "./redaction";
import { AIGatewayError, AITimeoutSignal, classifyProviderError, logProviderError } from "./errors";

const DEFAULT_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AITimeoutSignal()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface RouteAndCallParams {
  alias: TaskAlias;
  messages: ChatMessage[];
  classification: DataClassification;
  jsonSchema?: { name: string; schema: Record<string, unknown>; strict?: boolean };
  timeoutMs?: number;
}

export interface RouteAndCallResult extends ChatCompletionResult {
  requestedModel: string;
}

/**
 * Resolves an alias to its primary + fallback models, applies privacy
 * routing per the resolved data classification, and calls OpenRouter once
 * -- relying on OpenRouter's own `models` fallback array to try the
 * fallback chain server-side within that single call (see lib/ai/client.ts
 * and docs/ai/openrouter-architecture.md "Fallback Strategy"). If that
 * exhausts every model in the chain, OpenRouter itself returns an error,
 * which this function classifies as FALLBACK_EXHAUSTED when a fallback
 * chain existed, or the more specific classification otherwise.
 *
 * Every call must satisfy BOTH the task alias's sensitivityAllowance
 * (assertClassificationAllowed, checked first -- "is this task even
 * allowed to see data this sensitive") AND the provider privacy routing
 * rules (buildProviderPreferences -- "how must this be routed if it is
 * allowed"). Neither check substitutes for the other, and the sensitivity
 * check runs before any provider-routing decision or network call.
 */
export async function routeAndCall(params: RouteAndCallParams): Promise<RouteAndCallResult> {
  const route = getModelRoute(params.alias);
  assertClassificationAllowed(params.alias, route.sensitivityAllowance, params.classification);
  const providerPrefs = buildProviderPreferences(params.classification);

  const fallbackModels = route.fallbackModels.length > 0 ? route.fallbackModels : undefined;
  const defaultFallback = getDefaultFallbackModel();
  const models =
    fallbackModels ?? (defaultFallback && defaultFallback !== route.primaryModel ? [defaultFallback] : undefined);

  try {
    const result = await withTimeout(
      sendChatCompletion({
        model: route.primaryModel,
        fallbackModels: models,
        messages: params.messages,
        provider: providerPrefs,
        jsonSchema: params.jsonSchema,
      }),
      params.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    return { ...result, requestedModel: route.primaryModel };
  } catch (err) {
    if (err instanceof AIGatewayError) throw err;

    logProviderError(err, { alias: params.alias, requestedModel: route.primaryModel });
    const classified = classifyProviderError(err);
    // A provider/model-unavailable failure after OpenRouter already had a
    // fallback chain to try means the whole chain was exhausted.
    const hadFallbackChain = Boolean(models?.length);
    if (
      hadFallbackChain &&
      (classified.code === "MODEL_UNAVAILABLE" || classified.code === "PROVIDER_UNAVAILABLE")
    ) {
      throw new AIGatewayError(
        "FALLBACK_EXHAUSTED",
        "All configured models for this task were unavailable."
      );
    }
    throw classified;
  }
}
