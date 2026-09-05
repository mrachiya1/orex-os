import { describe, it, expect } from "vitest";
import { assertClassificationAllowed } from "./sensitivity";
import { AIGatewayError } from "./errors";

describe("assertClassificationAllowed", () => {
  it("allows a classification at or below the task's allowance", () => {
    expect(() => assertClassificationAllowed("ops.fast", "public_internal", "public")).not.toThrow();
    expect(() => assertClassificationAllowed("ops.fast", "public_internal", "internal")).not.toThrow();
    expect(() => assertClassificationAllowed("advisor.deep", "confidential", "confidential")).not.toThrow();
    expect(() => assertClassificationAllowed("finance.structured", "restricted", "restricted")).not.toThrow();
  });

  it("rejects a classification above the task's allowance", () => {
    expect(() => assertClassificationAllowed("ops.fast", "public_internal", "confidential")).toThrow(
      AIGatewayError
    );
  });

  it("rejects Restricted data for a public_internal-only task even though a ZDR provider could technically route it", () => {
    try {
      assertClassificationAllowed("knowledge.extract", "public_internal", "restricted");
      throw new Error("expected assertClassificationAllowed to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AIGatewayError);
      expect((err as AIGatewayError).code).toBe("TASK_SENSITIVITY_REJECTED");
    }
  });

  it("always rejects Secret, regardless of the task's allowance level", () => {
    for (const allowance of ["public_internal", "confidential", "restricted"] as const) {
      try {
        assertClassificationAllowed("some.alias", allowance, "secret");
        throw new Error("expected assertClassificationAllowed to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(AIGatewayError);
        expect((err as AIGatewayError).code).toBe("TASK_SENSITIVITY_REJECTED");
      }
    }
  });

  it("never includes raw content in its error message -- only the alias and classification labels", () => {
    try {
      assertClassificationAllowed("ops.fast", "public_internal", "restricted");
      throw new Error("expected to throw");
    } catch (err) {
      const message = (err as AIGatewayError).message;
      expect(message).toContain("ops.fast");
      expect(message).toContain("restricted");
      // The message is built entirely from the alias string and the fixed
      // classification enum values -- there is no code path here that could
      // interpolate arbitrary request content into it.
      expect(message.length).toBeLessThan(200);
    }
  });
});
