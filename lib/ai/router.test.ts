import { describe, it, expect, vi, beforeEach } from "vitest";

const sendChatCompletion = vi.fn();
vi.mock("./client", () => ({ sendChatCompletion: (...args: unknown[]) => sendChatCompletion(...args) }));

const { routeAndCall } = await import("./router");
const { AIGatewayError } = await import("./errors");

describe("routeAndCall", () => {
  beforeEach(() => {
    sendChatCompletion.mockReset();
  });

  it("returns the result on primary-model success", async () => {
    sendChatCompletion.mockResolvedValue({
      content: "hello",
      actualModel: "openai/gpt-5.4-mini",
      provider: "openai",
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cost: 0.001,
    });

    const result = await routeAndCall({
      alias: "ops.fast",
      messages: [{ role: "user", content: "hi" }],
      classification: "public",
    });

    expect(result.actualModel).toBe("openai/gpt-5.4-mini");
    expect(result.requestedModel).toBe("openai/gpt-5.4-mini");
    expect(sendChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("passes the alias's configured fallback models to the client", async () => {
    sendChatCompletion.mockResolvedValue({
      content: "ok",
      actualModel: "anthropic/claude-sonnet-4.6",
      provider: "anthropic",
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      cost: 0,
    });

    await routeAndCall({
      alias: "finance.structured",
      messages: [{ role: "user", content: "hi" }],
      classification: "restricted",
    });

    const callArgs = sendChatCompletion.mock.calls[0][0];
    expect(callArgs.model).toBe("openai/gpt-5.4-mini");
    expect(callArgs.fallbackModels).toContain("anthropic/claude-sonnet-4.6");
    // Restricted classification must apply ZDR provider routing.
    expect(callArgs.provider).toMatchObject({ zdr: true, dataCollection: "deny" });
  });

  it("classifies a provider-unavailable failure as FALLBACK_EXHAUSTED when a fallback chain existed", async () => {
    class ServiceUnavailableResponseError extends Error {}
    sendChatCompletion.mockRejectedValue(new ServiceUnavailableResponseError("down"));

    await expect(
      routeAndCall({
        alias: "finance.structured", // has a fallback model configured
        messages: [{ role: "user", content: "hi" }],
        classification: "public",
      })
    ).rejects.toMatchObject({ code: "FALLBACK_EXHAUSTED" });
  });

  it("classifies a provider-unavailable failure normally when no fallback chain existed", async () => {
    class ServiceUnavailableResponseError extends Error {}
    sendChatCompletion.mockRejectedValue(new ServiceUnavailableResponseError("down"));

    await expect(
      routeAndCall({
        alias: "ops.fast", // no fallback models configured, no OPENROUTER_DEFAULT_MODEL in test env
        messages: [{ role: "user", content: "hi" }],
        classification: "public",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("propagates an AIGatewayError thrown by the client without reclassifying it", async () => {
    sendChatCompletion.mockRejectedValue(
      new AIGatewayError("INVALID_STRUCTURED_OUTPUT", "bad output")
    );

    await expect(
      routeAndCall({
        alias: "ops.fast",
        messages: [{ role: "user", content: "hi" }],
        classification: "public",
      })
    ).rejects.toMatchObject({ code: "INVALID_STRUCTURED_OUTPUT" });
  });

  describe("task sensitivityAllowance enforcement", () => {
    it("rejects a Restricted request for a public_internal-only task before any network call", async () => {
      await expect(
        routeAndCall({
          alias: "ops.fast", // sensitivityAllowance: public_internal
          messages: [{ role: "user", content: "hi" }],
          classification: "restricted",
        })
      ).rejects.toMatchObject({ code: "TASK_SENSITIVITY_REJECTED" });
      expect(sendChatCompletion).not.toHaveBeenCalled();
    });

    it("rejects Confidential for a public_internal-only task before any network call", async () => {
      await expect(
        routeAndCall({
          alias: "ops.fast",
          messages: [{ role: "user", content: "hi" }],
          classification: "confidential",
        })
      ).rejects.toMatchObject({ code: "TASK_SENSITIVITY_REJECTED" });
      expect(sendChatCompletion).not.toHaveBeenCalled();
    });

    it("rejects Secret even for a task whose allowance is restricted (the highest tier)", async () => {
      await expect(
        routeAndCall({
          alias: "finance.structured", // sensitivityAllowance: restricted
          messages: [{ role: "user", content: "hi" }],
          classification: "secret",
        })
      ).rejects.toMatchObject({ code: "TASK_SENSITIVITY_REJECTED" });
      expect(sendChatCompletion).not.toHaveBeenCalled();
    });

    it("allows a Restricted request for a task whose allowance is restricted, and still applies ZDR routing", async () => {
      sendChatCompletion.mockResolvedValue({
        content: "ok",
        actualModel: "openai/gpt-5.4-mini",
        provider: "openai",
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        cost: 0,
      });

      await routeAndCall({
        alias: "finance.structured",
        messages: [{ role: "user", content: "hi" }],
        classification: "restricted",
      });

      expect(sendChatCompletion).toHaveBeenCalledTimes(1);
      const callArgs = sendChatCompletion.mock.calls[0][0];
      expect(callArgs.provider).toMatchObject({ zdr: true });
    });

    it("returns a safe error containing no request content, only alias/classification labels", async () => {
      try {
        await routeAndCall({
          alias: "ops.fast",
          messages: [{ role: "user", content: "a very secret internal detail that must never leak" }],
          classification: "restricted",
        });
        throw new Error("expected routeAndCall to throw");
      } catch (err) {
        const message = (err as InstanceType<typeof AIGatewayError>).message;
        expect(message).not.toContain("secret internal detail");
        expect(sendChatCompletion).not.toHaveBeenCalled();
      }
    });
  });
});
