import { describe, it, expect } from "vitest";
import { routeAndCall } from "../router";
import { validateStructuredOutput, toJsonSchemaResponseFormat } from "../structured-output";
import { extractCandidateFactsSchema } from "./knowledge";

/**
 * Real network integration test confirming the knowledge.extract task alias
 * actually produces valid, schema-conforming candidate facts from the real
 * model -- not just that the Zod schema itself is well-formed (covered by
 * unit tests). Run explicitly via `npm run test:integration`.
 */
const hasKey = Boolean(process.env.OPENROUTER_API_KEY);

describe.skipIf(!hasKey)("knowledge.extract structured output (live integration)", () => {
  it("extracts schema-conforming candidate facts from real pasted text", async () => {
    const jsonSchema = toJsonSchemaResponseFormat("extract_candidate_facts", extractCandidateFactsSchema);

    const result = await routeAndCall({
      alias: "knowledge.extract",
      classification: "internal",
      jsonSchema,
      messages: [
        {
          role: "system",
          content:
            "Extract discrete candidate company knowledge facts from the text. " +
            "Each candidate needs a title, content, a domain from " +
            "(identity, business, strategy, goals, operations, sales, knowledge), " +
            "an itemType from (fact, document, vision, mission, goal, service, strategy, " +
            "rule, policy, process, sop, lesson, win, failure, research), and a confidence 0-1.",
        },
        {
          role: "user",
          content:
            "Orextic's standard hourly rate for AI automation work is $150. " +
            "We never discount below cost. Our mission is to make advanced AI accessible to small businesses.",
        },
      ],
    });

    const parsed = validateStructuredOutput(result.content, extractCandidateFactsSchema);
    expect(parsed.candidates.length).toBeGreaterThan(0);
    for (const candidate of parsed.candidates) {
      expect(candidate.confidence).toBeGreaterThanOrEqual(0);
      expect(candidate.confidence).toBeLessThanOrEqual(1);
      expect(candidate.title.length).toBeGreaterThan(0);
    }
  });
});
