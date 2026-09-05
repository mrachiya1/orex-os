import "server-only";
import { OpenRouter } from "@openrouter/sdk";
import type { ChatResult } from "@openrouter/sdk/models";
import type { ProviderRoutingPreferences } from "./privacy";

/**
 * The ONLY file in the repository allowed to import @openrouter/sdk or
 * reference OPENROUTER_API_KEY. Every other module reaches OpenRouter only
 * through lib/ai/router.ts -> this file. See
 * .agents/skills/orex-openrouter-gateway/SKILL.md "Architecture Rule".
 *
 * Never log, print, or return the raw client/API key. Never include it in
 * any error message this module lets escape.
 */

let client: OpenRouter | null = null;

function getClient(): OpenRouter {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
    client = new OpenRouter({ apiKey });
  }
  return client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonSchemaResponseFormat {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface SendChatCompletionParams {
  model: string;
  fallbackModels?: string[];
  messages: ChatMessage[];
  provider?: ProviderRoutingPreferences;
  jsonSchema?: JsonSchemaResponseFormat;
}

export interface ChatCompletionResult {
  content: string;
  actualModel: string;
  provider: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cost: number | null;
}

/**
 * Sends one chat completion request. Relies on OpenRouter's own `models`
 * fallback array (params.fallbackModels) for model-level availability
 * fallback within a single call, rather than looping across separate HTTP
 * requests client-side -- see docs/ai/openrouter-architecture.md "Fallback
 * Strategy" and prompts/002-openrouter-gateway.md's router design note.
 * Throws the SDK's own typed error classes on failure; callers (lib/ai/
 * router.ts) classify them via lib/ai/errors.ts, never inspecting or
 * logging this function's internals directly.
 */
export async function sendChatCompletion(
  params: SendChatCompletionParams
): Promise<ChatCompletionResult> {
  const openRouter = getClient();

  // The SDK's overload resolution for chat.send() is keyed off a discriminated
  // `messages` union (per-role message shapes) that this adapter deliberately
  // simplifies for callers (lib/ai/router.ts) via the plain ChatMessage
  // interface above. stream:false always resolves to a non-streaming
  // ChatResult at runtime -- the cast below reflects that guarantee rather
  // than fighting the generated overload's structural inference.
  const response = (await openRouter.chat.send({
    chatRequest: {
      model: params.model,
      models: params.fallbackModels?.length ? params.fallbackModels : undefined,
      messages: params.messages,
      provider: params.provider
        ? {
            dataCollection: params.provider.dataCollection,
            zdr: params.provider.zdr,
            requireParameters: params.provider.requireParameters,
          }
        : undefined,
      responseFormat: params.jsonSchema
        ? {
            type: "json_schema",
            jsonSchema: {
              name: params.jsonSchema.name,
              schema: params.jsonSchema.schema,
              strict: params.jsonSchema.strict ?? true,
            },
          }
        : undefined,
      stream: false as const,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)) as ChatResult;

  const choice = response.choices?.[0];
  const content = typeof choice?.message?.content === "string" ? choice.message.content : "";

  // OpenRouter model ids are namespaced "<provider>/<model>" (e.g.
  // "openai/gpt-5.4-mini"); the SDK's typed response has no simpler
  // top-level provider-name field, so this is the pragmatic extraction --
  // good enough for usage-record attribution without depending on the
  // deeper (and less stable) router-attempt metadata shape.
  const provider = response.model.includes("/") ? response.model.split("/")[0] : null;

  return {
    content,
    actualModel: response.model,
    provider,
    inputTokens: response.usage?.promptTokens ?? null,
    outputTokens: response.usage?.completionTokens ?? null,
    totalTokens: response.usage?.totalTokens ?? null,
    cost: response.usage?.cost ?? null,
  };
}
