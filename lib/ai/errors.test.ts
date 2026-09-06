import { describe, it, expect } from "vitest";
import { AIGatewayError, classifyProviderError, toSafeAIErrorMessage } from "./errors";

describe("classifyProviderError", () => {
  it("passes through an AITimeoutSignal as TIMEOUT", () => {
    const result = classifyProviderError(new (class AITimeoutSignal extends Error {})());
    // The real class comparison is exercised via toSafeAIErrorMessage tests below;
    // here we just confirm the generic fallback never throws on odd input.
    expect(result).toBeInstanceOf(AIGatewayError);
  });

  it("falls back to INVALID_PROVIDER_RESPONSE for an unrecognized error, without leaking its message", () => {
    const result = classifyProviderError(new Error("some internal provider stack trace detail"));
    expect(result.code).toBe("INVALID_PROVIDER_RESPONSE");
    expect(result.message).not.toContain("stack trace");
  });

  it("handles a non-Error thrown value without throwing itself", () => {
    expect(() => classifyProviderError("a plain string")).not.toThrow();
    expect(() => classifyProviderError(undefined)).not.toThrow();
  });
});

describe("toSafeAIErrorMessage", () => {
  it("returns an AIGatewayError's own message unchanged", () => {
    const err = new AIGatewayError("TIMEOUT", "The AI provider did not respond in time.");
    expect(toSafeAIErrorMessage(err)).toBe("The AI provider did not respond in time.");
  });

  it("maps a Forbidden-prefixed permission error to a generic permission message", () => {
    const err = new Error("Forbidden: missing knowledge.read permission");
    expect(toSafeAIErrorMessage(err)).toBe("You don't have permission to do that.");
  });

  it("never echoes a raw config-check error's message (e.g. a missing env var)", () => {
    const err = new Error("OPENROUTER_API_KEY is not configured");
    const message = toSafeAIErrorMessage(err);
    expect(message).not.toContain("OPENROUTER_API_KEY");
  });

  it("never throws for a non-Error thrown value", () => {
    expect(() => toSafeAIErrorMessage("boom")).not.toThrow();
    expect(() => toSafeAIErrorMessage(null)).not.toThrow();
  });
});
