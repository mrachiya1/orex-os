import { describe, it, expect } from "vitest";
import { routeAndCall } from "./router";

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

if (!hasKey) {
  console.log("Skipping live OpenRouter integration tests: OPENROUTER_API_KEY not configured.");
}
