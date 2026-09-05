import { describe, it, expect } from "vitest";
import { embedText, EMBEDDING_DIMENSION } from "./embeddings";

/**
 * Real network integration test against OpenRouter's embeddings endpoint --
 * run explicitly via `npm run test:integration`, never as part of
 * `npm run test`. Requires OPENROUTER_API_KEY and OPENROUTER_EMBEDDING_MODEL
 * in .env.local. Skips itself (rather than failing) if no key is
 * configured. Never logs, prints, or asserts on the API key's value.
 */
const hasKey = Boolean(process.env.OPENROUTER_API_KEY);

describe.skipIf(!hasKey)("embedText (live OpenRouter embeddings integration)", () => {
  it("returns a real 1536-dimension embedding for public content", async () => {
    const result = await embedText({
      text: "Orextic provides AI transformation and automation services.",
      classification: "public",
      // No real authenticated session exists in this test harness --
      // actor_user_id is nullable in ai_usage_events for exactly this case
      // (a null actor never satisfies the user_profiles FK, so this avoids
      // a spurious insert failure while still exercising the real usage
      // write path).
      actorUserId: null,
      taskAlias: "knowledge.embed.integration-test",
    });

    expect(result.embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(result.dimension).toBe(EMBEDDING_DIMENSION);
    expect(typeof result.embedding[0]).toBe("number");
    expect(result.model).toBeTruthy();
  });

  it("returns a real embedding for restricted content via ZDR routing without erroring", async () => {
    const result = await embedText({
      text: "Internal pricing principle: never discount below cost.",
      classification: "restricted",
      actorUserId: null,
      taskAlias: "knowledge.embed.integration-test",
    });
    expect(result.embedding).toHaveLength(EMBEDDING_DIMENSION);
  });
});
