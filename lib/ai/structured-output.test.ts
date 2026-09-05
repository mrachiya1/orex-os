import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateStructuredOutput, toJsonSchemaResponseFormat } from "./structured-output";
import { AIGatewayError } from "./errors";

const schema = z.object({ summary: z.string(), confidence: z.number().min(0).max(1) });

describe("validateStructuredOutput", () => {
  it("parses and validates well-formed matching JSON", () => {
    const result = validateStructuredOutput(
      JSON.stringify({ summary: "ok", confidence: 0.9 }),
      schema
    );
    expect(result).toEqual({ summary: "ok", confidence: 0.9 });
  });

  it("rejects malformed (non-JSON) output", () => {
    expect(() => validateStructuredOutput("not json{{{", schema)).toThrow(AIGatewayError);
  });

  it("rejects valid JSON that doesn't match the schema", () => {
    try {
      validateStructuredOutput(JSON.stringify({ summary: "ok" }), schema);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AIGatewayError);
      expect((err as AIGatewayError).code).toBe("INVALID_STRUCTURED_OUTPUT");
    }
  });

  it("rejects a schema violation (out-of-range value), never coercing it", () => {
    expect(() =>
      validateStructuredOutput(JSON.stringify({ summary: "ok", confidence: 5 }), schema)
    ).toThrow(AIGatewayError);
  });
});

describe("toJsonSchemaResponseFormat", () => {
  it("produces a name + JSON schema object from a Zod schema", () => {
    const format = toJsonSchemaResponseFormat("test_result", schema);
    expect(format.name).toBe("test_result");
    expect(format.strict).toBe(true);
    expect(format.schema).toHaveProperty("properties");
  });
});
