import { describe, it, expect } from "vitest";
import { z } from "zod";
import { routeAndCall } from "./router";
import { sendChatCompletion } from "./client";
import { toJsonSchemaResponseFormat, validateStructuredOutput } from "./structured-output";

/**
 * Real network integration test against OpenRouter -- run explicitly via
 * `npm run test:integration`, never as part of `npm run test`. Requires
 * OPENROUTER_API_KEY in .env.local. Skips itself (rather than failing) if
 * no key is configured, so the default test suite and CI are unaffected.
 *
 * Never logs, prints, or asserts on the API key's value -- only on the
 * shape of the response (model/provider/token/cost metadata), which is
 * exactly what lib/ai/usage.ts persists to ai_usage_events.
 */
const hasKey = Boolean(process.env.OPENROUTER_API_KEY);

describe.skipIf(!hasKey)("routeAndCall (live OpenRouter integration)", () => {
  it("calls the real ops.fast primary model and returns real usage metadata", async () => {
    const result = await routeAndCall({
      alias: "ops.fast",
      messages: [
        { role: "system", content: "Reply with exactly one word: pong." },
        { role: "user", content: "ping" },
      ],
      classification: "public",
    });

    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.actualModel).toBeTruthy();
    expect(result.requestedModel).toBe("openai/gpt-5.4-mini");
    // Real token/cost metadata should be present, not synthesized.
    expect(result.totalTokens).not.toBeNull();
    expect(typeof result.totalTokens).toBe("number");
  });

  it("applies ZDR provider routing for Restricted-classified requests without erroring", async () => {
    const result = await routeAndCall({
      alias: "finance.structured",
      messages: [
        { role: "system", content: "Reply with exactly one word: pong." },
        { role: "user", content: "ping" },
      ],
      classification: "restricted",
    });

    expect(result.content.length).toBeGreaterThan(0);
  });
});

/**
 * Verifies the configured default chat/reasoning model (OPENROUTER_DEFAULT_MODEL,
 * openai/gpt-5-mini) directly, independent of any one alias's primary model
 * -- see lib/ai/model-registry.ts's getDefaultFallbackModel doc comment.
 */
describe.skipIf(!hasKey)("openai/gpt-5-mini (live OpenRouter integration)", () => {
  it("1. answers a raw chat completion as the primary model", async () => {
    const result = await sendChatCompletion({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: "Reply with exactly one word: pong." },
        { role: "user", content: "ping" },
      ],
    });

    expect(result.content.length).toBeGreaterThan(0);
    expect(result.actualModel).toContain("gpt-5-mini");
  });

  it("1b. also works when used only as the fallback behind a deliberately invalid primary model", async () => {
    const result = await sendChatCompletion({
      model: "openai/this-model-does-not-exist-xyz",
      fallbackModels: ["openai/gpt-5-mini"],
      messages: [
        { role: "system", content: "Reply with exactly one word: pong." },
        { role: "user", content: "ping" },
      ],
    });

    expect(result.content.length).toBeGreaterThan(0);
    expect(result.actualModel).toContain("gpt-5-mini");
  });

  it("2. produces structured JSON output that validates against a real Zod schema", async () => {
    const schema = z.object({
      answer: z.string().min(1),
      citedSources: z.array(z.object({ knowledgeItemId: z.string(), title: z.string() })),
    });

    const result = await routeAndCall({
      alias: "advisor.deep",
      messages: [
        {
          role: "system",
          content:
            'Respond ONLY with JSON matching this shape: {"answer": string, "citedSources": []}. ' +
            'Set answer to exactly "ok" and citedSources to an empty array.',
        },
        { role: "user", content: "test" },
      ],
      classification: "public",
      jsonSchema: toJsonSchemaResponseFormat("test_schema", schema),
    });

    const parsed = validateStructuredOutput(result.content, schema);
    expect(parsed.answer).toBeTruthy();
    expect(Array.isArray(parsed.citedSources)).toBe(true);
  });

  it("3. supports native OpenRouter tool calling", async () => {
    const result = await sendChatCompletion({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: "You must call the get_weather tool for any location the user asks about." },
        { role: "user", content: "What is the weather in Paris?" },
      ],
      tools: [
        {
          name: "get_weather",
          description: "Get the current weather for a location",
          parameters: {
            type: "object",
            properties: { location: { type: "string" } },
            required: ["location"],
          },
        },
      ],
    });

    expect(result.toolCalls.length).toBeGreaterThan(0);
    expect(result.toolCalls[0].name).toBe("get_weather");
    expect(() => JSON.parse(result.toolCalls[0].arguments)).not.toThrow();
  });
});

if (!hasKey) {
  console.log("Skipping live OpenRouter integration tests: OPENROUTER_API_KEY not configured.");
}
