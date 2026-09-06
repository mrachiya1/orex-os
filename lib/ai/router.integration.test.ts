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
  it("0. direct isolation test: a tiny strict JSON schema, independent of any alias/Company Brain config", async () => {
    const schema = z.object({ message: z.string() });
    const result = await sendChatCompletion({
      model: "openai/gpt-5-mini",
      messages: [{ role: "user", content: "Say hello." }],
      jsonSchema: toJsonSchemaResponseFormat("say_hello", schema),
      provider: { requireParameters: true },
    });

    const parsed = validateStructuredOutput(result.content, schema);
    expect(typeof parsed.message).toBe("string");
    expect(parsed.message.length).toBeGreaterThan(0);
  });

  it("0b. REGRESSION GUARD: a root-level Zod discriminated union (the exact shape that caused the production incident) is rejected outright by OpenRouter for gpt-5-mini", async () => {
    // Empirically confirmed root cause of the "model's response was not
    // valid JSON" production incident: a Zod discriminatedUnion converts
    // to a root-level `oneOf` JSON Schema (verified via z.toJSONSchema),
    // which OpenAI-family strict structured outputs do not support at the
    // schema root. For gpt-5-mini this manifests as an outright 400 from
    // OpenRouter (confirmed here) -- Claude Sonnet (agent.tools' actual
    // primary model) instead silently ignored strict enforcement and
    // returned prose, which is what produced the JSON.parse failure in
    // production. Either way: never use a root union schema again -- see
    // lib/ai/schemas/agent-command.ts's flattened agentCommandWireSchema.
    const brokenUnionSchema = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("a"), value: z.string() }),
      z.object({ kind: z.literal("b"), value: z.number() }),
    ]);
    await expect(
      sendChatCompletion({
        model: "openai/gpt-5-mini",
        messages: [{ role: "user", content: "Say hi." }],
        jsonSchema: toJsonSchemaResponseFormat("broken_union", brokenUnionSchema),
      })
    ).rejects.toThrow();
  });

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

  it("1b. also works when named second in a real fallback chain", async () => {
    // OpenRouter validates the primary `model` id itself before considering
    // any fallback -- a syntactically-unknown model id (as opposed to a
    // real, valid model that's merely unavailable) is rejected outright, so
    // a genuinely invalid primary can't be used to test the fallback path.
    // Using a second real model as primary and gpt-5-mini as its listed
    // fallback instead confirms gpt-5-mini is at least reachable via the
    // same `models` array mechanism getDefaultFallbackModel() relies on.
    const result = await sendChatCompletion({
      model: "openai/gpt-5.4-mini",
      fallbackModels: ["openai/gpt-5-mini"],
      messages: [
        { role: "system", content: "Reply with exactly one word: pong." },
        { role: "user", content: "ping" },
      ],
    });

    expect(result.content.length).toBeGreaterThan(0);
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

  it("2b. the actual production wire schema (flat object, nested array, enum, nullable fields) round-trips end to end", async () => {
    const { agentCommandWireSchema, toAgentCommandResult } = await import("./schemas/agent-command");
    const result = await sendChatCompletion({
      model: "openai/gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            'Respond with kind="answer", answer="Hi there.", citedSources=[]. Set every other field to null.',
        },
        { role: "user", content: "Hi" },
      ],
      jsonSchema: toJsonSchemaResponseFormat("agent_command", agentCommandWireSchema),
      provider: { requireParameters: true },
    });

    const wire = validateStructuredOutput(result.content, agentCommandWireSchema);
    const mapped = toAgentCommandResult(wire);
    expect(mapped.kind).toBe("answer");
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
