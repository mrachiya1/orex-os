import "server-only";
import { z } from "zod";
import { AIGatewayError } from "./errors";

/**
 * Parses a model's raw text response as JSON and validates it against the
 * task's Zod schema. A response that fails either step is a failure --
 * never coerced, defaulted, or partially trusted. See
 * prompts/002-openrouter-gateway.md "Structured Outputs".
 */
export function validateStructuredOutput<T>(rawContent: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new AIGatewayError(
      "INVALID_STRUCTURED_OUTPUT",
      "The model's response was not valid JSON."
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AIGatewayError(
      "INVALID_STRUCTURED_OUTPUT",
      "The model's response did not match the expected schema."
    );
  }

  return result.data;
}

/**
 * Builds the OpenRouter json_schema response-format payload from a Zod
 * schema, using Zod 4's built-in JSON Schema conversion (no extra
 * dependency needed).
 */
export function toJsonSchemaResponseFormat(
  name: string,
  schema: z.ZodType
): { name: string; schema: Record<string, unknown>; strict: boolean } {
  return {
    name,
    schema: z.toJSONSchema(schema) as Record<string, unknown>,
    strict: true,
  };
}
