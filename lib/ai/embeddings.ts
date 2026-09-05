import "server-only";
import { OpenRouter } from "@openrouter/sdk";
import type { CreateEmbeddingsResponseBody } from "@openrouter/sdk/models/operations";
import type { DataClassification } from "./redaction";
import { buildProviderPreferences } from "./privacy";
import { AIGatewayError, classifyProviderError, type AIErrorCode } from "./errors";
import { recordUsage } from "./usage";

/**
 * The ONLY file in the repository allowed to import @openrouter/sdk for
 * embeddings (mirrors lib/ai/client.ts's exclusive ownership of chat
 * completions). No Company Brain or feature code may import
 * @openrouter/sdk directly -- see prompts/003-company-brain.md section 13
 * and the founder's Phase 003 embeddings decision.
 *
 * Model is configuration (OPENROUTER_EMBEDDING_MODEL); the vector
 * dimension is NOT -- it is fixed for this schema version
 * (knowledge_chunks.embedding is vector(1536)). Changing to a model with a
 * different output dimension requires an explicit migration, re-embedding
 * every existing chunk, and an index rebuild -- never a silent runtime
 * model swap. This module hard-checks the returned dimension against
 * EXPECTED_DIMENSION and refuses to return a mismatched vector.
 *
 * Every call records exactly one ai_usage_events row (success or failure),
 * via the same lib/ai/usage.ts helper and table Phase 002 chat completions
 * already use -- no separate embeddings usage table. Never the embedded
 * text itself, only operational metadata (see recordUsage's UsageEventInput
 * shape), exactly like every other lib/ai usage record.
 */

export const EMBEDDING_DIMENSION = 1536;
const DEFAULT_TASK_ALIAS = "knowledge.embed";

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

function getEmbeddingModel(): string {
  const model = process.env.OPENROUTER_EMBEDDING_MODEL;
  if (!model) {
    throw new Error("OPENROUTER_EMBEDDING_MODEL is not configured");
  }
  return model;
}

export interface EmbedTextParams {
  text: string;
  classification: DataClassification;
  /** Attribution for the ai_usage_events row -- the human who triggered this embed, or null if none (should not normally happen; every call site resolves a real user first). */
  actorUserId: string | null;
  organisationId?: string | null;
  companyId?: string | null;
  /** Defaults to "knowledge.embed"; callers may pass a more specific label (e.g. "knowledge.retrieve" for a query embedding) purely for usage-event visibility -- never a routing decision. */
  taskAlias?: string;
}

export interface EmbedTextResult {
  embedding: number[];
  model: string;
  dimension: number;
}

/**
 * Embeds one piece of text. Secret-classified content is refused before any
 * network call -- never embedded, unconditionally (docs/ai/context-policy.md
 * "Data Classification Rules"). Confidential/Restricted content passes
 * through the same provider-routing rules as a chat completion
 * (lib/ai/privacy.ts) before being sent.
 */
export async function embedText(params: EmbedTextParams): Promise<EmbedTextResult> {
  const startedAt = Date.now();
  const taskAlias = params.taskAlias ?? DEFAULT_TASK_ALIAS;
  const requestedModel = process.env.OPENROUTER_EMBEDDING_MODEL || null;

  let errorCode: AIErrorCode | null = null;
  let actualModel: string | null = null;
  let provider: string | null = null;
  let totalTokens: number | null = null;
  let estimatedCost: number | null = null;

  try {
    if (params.classification === "secret") {
      throw new AIGatewayError(
        "PRIVACY_POLICY_REJECTED",
        "Secret-classified content must never be embedded."
      );
    }

    const providerPrefs = buildProviderPreferences(params.classification);
    const model = getEmbeddingModel();
    const openRouter = getClient();

    const response = (await openRouter.embeddings.generate({
      requestBody: {
        model,
        input: params.text,
        dimensions: EMBEDDING_DIMENSION,
        provider: providerPrefs
          ? {
              dataCollection: providerPrefs.dataCollection,
              zdr: providerPrefs.zdr,
              requireParameters: providerPrefs.requireParameters,
            }
          : undefined,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)) as CreateEmbeddingsResponseBody;

    actualModel = response.model ?? model;
    // Unlike chat completions, the embeddings endpoint's response.model is
    // sometimes returned without its provider prefix (e.g.
    // "text-embedding-3-small" rather than "openai/text-embedding-3-small")
    // -- fall back to the requested model's own prefix, which is always
    // configured in "<provider>/<model>" form (OPENROUTER_EMBEDDING_MODEL).
    provider = actualModel.includes("/")
      ? actualModel.split("/")[0]
      : requestedModel?.includes("/")
        ? requestedModel.split("/")[0]
        : null;
    totalTokens = response.usage?.totalTokens ?? null;
    estimatedCost = response.usage?.cost ?? null;

    const first = response.data?.[0];
    const embedding = first?.embedding;
    if (!Array.isArray(embedding) || typeof embedding[0] !== "number") {
      throw new AIGatewayError(
        "INVALID_PROVIDER_RESPONSE",
        "The embeddings provider returned an unexpected response shape."
      );
    }

    if (embedding.length !== EMBEDDING_DIMENSION) {
      // A runtime model change to an incompatible dimension must never be
      // silently accepted -- fail closed rather than writing a mismatched
      // vector into a fixed-width vector(1536) column.
      throw new AIGatewayError(
        "INVALID_PROVIDER_RESPONSE",
        `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, received ${embedding.length}.`
      );
    }

    return {
      embedding: embedding as number[],
      model: actualModel,
      dimension: embedding.length,
    };
  } catch (err) {
    const classified = err instanceof AIGatewayError ? err : classifyProviderError(err);
    errorCode = classified.code;
    throw classified;
  } finally {
    await recordUsage({
      actorUserId: params.actorUserId,
      organisationId: params.organisationId ?? null,
      companyId: params.companyId ?? null,
      taskAlias,
      requestedModel,
      actualModel,
      provider,
      inputTokens: null,
      outputTokens: null,
      totalTokens,
      estimatedCost,
      latencyMs: Date.now() - startedAt,
      resultStatus: errorCode ? "failure" : "success",
      promptVersion: null,
      errorClassification: errorCode,
    });
  }
}
