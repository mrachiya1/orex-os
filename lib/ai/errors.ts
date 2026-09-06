/**
 * Normalized AI gateway error taxonomy. Every failure mode the gateway can
 * produce is one of these -- never a raw provider error, never containing
 * the API key or raw internal context. See
 * prompts/002-openrouter-gateway.md "Error Handling".
 */
export type AIErrorCode =
  | "OPENROUTER_UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "MODEL_UNAVAILABLE"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "INVALID_PROVIDER_RESPONSE"
  | "INVALID_STRUCTURED_OUTPUT"
  | "CONTEXT_CONSTRUCTION_FAILED"
  | "PERMISSION_DENIED"
  | "COMPANY_RESOLUTION_FAILED"
  | "PRIVACY_POLICY_REJECTED"
  | "FALLBACK_EXHAUSTED"
  | "UNKNOWN_TASK_ALIAS"
  | "TASK_SENSITIVITY_REJECTED";

/** Thrown internally by lib/ai/router.ts's timeout wrapper; classified below. */
export class AITimeoutSignal extends Error {
  constructor() {
    super("AI request timed out");
    this.name = "AITimeoutSignal";
  }
}

export class AIGatewayError extends Error {
  readonly code: AIErrorCode;

  constructor(code: AIErrorCode, message: string) {
    super(message);
    this.name = "AIGatewayError";
    this.code = code;
  }
}

/**
 * Classifies a thrown error from the OpenRouter SDK (or a timeout we raised
 * ourselves) into our normalized taxonomy, without leaking the original
 * error's message (which may contain provider-internal detail) to callers.
 * The full underlying error is still logged server-side (never including
 * the API key, per lib/ai/client.ts) for debugging.
 */
export function classifyProviderError(err: unknown): AIGatewayError {
  if (err instanceof AITimeoutSignal) {
    return new AIGatewayError("TIMEOUT", "The AI provider did not respond in time.");
  }

  const name = err instanceof Error ? err.constructor.name : "";
  const status =
    err && typeof err === "object" && "statusCode" in err
      ? Number((err as { statusCode?: unknown }).statusCode)
      : undefined;

  if (name === "RequestTimeoutError") {
    return new AIGatewayError("TIMEOUT", "The AI provider did not respond in time.");
  }
  if (name === "TooManyRequestsResponseError" || status === 429) {
    return new AIGatewayError("RATE_LIMITED", "The AI provider is rate-limiting requests.");
  }
  if (
    name === "ServiceUnavailableResponseError" ||
    name === "BadGatewayResponseError" ||
    name === "ProviderOverloadedResponseError" ||
    name === "EdgeNetworkTimeoutResponseError" ||
    (status !== undefined && status >= 500)
  ) {
    return new AIGatewayError("PROVIDER_UNAVAILABLE", "The AI provider is currently unavailable.");
  }
  if (
    name === "NotFoundResponseError" ||
    name === "BadRequestResponseError" ||
    name === "UnprocessableEntityResponseError" ||
    status === 404 ||
    status === 400 ||
    status === 422
  ) {
    // Observed in practice: OpenRouter returns 400 for an unrecognized or
    // misconfigured model id, not just 404 -- both indicate "this specific
    // model can't serve the request," which is what MODEL_UNAVAILABLE means
    // here (as opposed to PROVIDER_UNAVAILABLE, a transient outage).
    return new AIGatewayError("MODEL_UNAVAILABLE", "The requested model is not available.");
  }
  if (name === "ConnectionError" || name === "RequestAbortedError") {
    return new AIGatewayError("OPENROUTER_UNAVAILABLE", "Could not reach the AI provider.");
  }

  return new AIGatewayError("INVALID_PROVIDER_RESPONSE", "The AI provider returned an unexpected response.");
}

/**
 * The one adapter every AI-calling Server Action should use at its
 * outermost catch, so no raw error (including a config-check throw like
 * "OPENROUTER_API_KEY is not configured" from client.ts/embeddings.ts,
 * which bypasses classifyProviderError entirely by throwing before their
 * own try block) ever crosses the "use server" boundary -- see
 * lib/actions/result.ts for why that specifically breaks in production
 * (Next.js redacts thrown Server Action error messages into a generic
 * digest, "Minified React error #441").
 *
 * A permission-denial `Error("Forbidden: ...")` (the convention used by
 * lib/permissions/index.ts and this action's own explicit checks) gets its
 * own message rather than being misclassified as a provider failure.
 * Anything else -- a genuinely unexpected error -- goes through
 * classifyProviderError's safe fallback, which never leaks the original
 * message.
 */
export function toSafeAIErrorMessage(err: unknown): string {
  if (err instanceof AIGatewayError) return err.message;
  if (err instanceof Error && err.message.startsWith("Forbidden")) {
    return "You don't have permission to do that.";
  }
  return classifyProviderError(err).message;
}
