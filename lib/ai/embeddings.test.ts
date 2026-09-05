import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generate = vi.fn();
const recordUsage = vi.fn();

vi.mock("@openrouter/sdk", () => ({
  OpenRouter: class {
    embeddings = { generate: (...args: unknown[]) => generate(...args) };
  },
}));
vi.mock("./usage", () => ({ recordUsage: (...args: unknown[]) => recordUsage(...args) }));

const ORIGINAL_ENV = { ...process.env };

const { embedText, EMBEDDING_DIMENSION } = await import("./embeddings");
const { AIGatewayError } = await import("./errors");

const actorUserId = "11111111-1111-4111-8111-111111111111";

describe("embedText", () => {
  beforeEach(() => {
    generate.mockReset();
    recordUsage.mockReset();
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("refuses to embed Secret-classified content without ever calling the provider", async () => {
    await expect(
      embedText({ text: "top secret", classification: "secret", actorUserId })
    ).rejects.toThrow(AIGatewayError);
    expect(generate).not.toHaveBeenCalled();
    // Still records one failed usage row -- visibility that an attempt was
    // made -- but never the attempted text.
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(recordUsage.mock.calls[0][0]).toMatchObject({
      resultStatus: "failure",
      errorClassification: "PRIVACY_POLICY_REJECTED",
    });
    expect(JSON.stringify(recordUsage.mock.calls[0][0])).not.toContain("top secret");
  });

  it("embeds Public content with no provider constraint", async () => {
    generate.mockResolvedValue({
      model: "openai/text-embedding-3-small",
      data: [{ embedding: Array(EMBEDDING_DIMENSION).fill(0.1), index: 0, object: "embedding" }],
      usage: { promptTokens: 4, totalTokens: 4, cost: 0.00001 },
    });

    const result = await embedText({ text: "our mission", classification: "public", actorUserId });
    expect(result.dimension).toBe(EMBEDDING_DIMENSION);
    expect(result.embedding).toHaveLength(EMBEDDING_DIMENSION);
    const callArgs = generate.mock.calls[0][0];
    expect(callArgs.requestBody.provider).toBeUndefined();
  });

  it("applies ZDR provider routing for Restricted content", async () => {
    generate.mockResolvedValue({
      model: "openai/text-embedding-3-small",
      data: [{ embedding: Array(EMBEDDING_DIMENSION).fill(0.1), index: 0, object: "embedding" }],
    });

    await embedText({ text: "restricted content", classification: "restricted", actorUserId });
    const callArgs = generate.mock.calls[0][0];
    expect(callArgs.requestBody.provider).toMatchObject({ zdr: true, dataCollection: "deny" });
  });

  it("fails closed on a dimension mismatch rather than storing a mismatched vector", async () => {
    generate.mockResolvedValue({
      model: "some/other-model",
      data: [{ embedding: Array(768).fill(0.1), index: 0, object: "embedding" }],
    });

    await expect(
      embedText({ text: "hi", classification: "internal", actorUserId })
    ).rejects.toThrow(AIGatewayError);
  });

  it("fails closed when the provider response has no embedding array", async () => {
    generate.mockResolvedValue({ model: "x", data: [] });
    await expect(
      embedText({ text: "hi", classification: "internal", actorUserId })
    ).rejects.toThrow(AIGatewayError);
  });

  it("records a success usage event with real token/cost metadata and no embedded text", async () => {
    generate.mockResolvedValue({
      model: "openai/text-embedding-3-small",
      data: [{ embedding: Array(EMBEDDING_DIMENSION).fill(0.1), index: 0, object: "embedding" }],
      usage: { promptTokens: 7, totalTokens: 7, cost: 0.00002 },
    });

    await embedText({
      text: "some company content that must never be persisted",
      classification: "internal",
      actorUserId,
      organisationId: "org-1",
      companyId: "company-1",
      taskAlias: "knowledge.embed",
    });

    expect(recordUsage).toHaveBeenCalledTimes(1);
    const usageRow = recordUsage.mock.calls[0][0];
    expect(usageRow).toMatchObject({
      resultStatus: "success",
      taskAlias: "knowledge.embed",
      totalTokens: 7,
      estimatedCost: 0.00002,
      actorUserId,
      organisationId: "org-1",
      companyId: "company-1",
    });
    expect(JSON.stringify(usageRow)).not.toContain("company content that must never be persisted");
  });

  it("records a failure usage event (with error classification, no content) when the provider call throws", async () => {
    generate.mockRejectedValue(new Error("network blew up"));

    await expect(
      embedText({ text: "sensitive draft policy text", classification: "internal", actorUserId })
    ).rejects.toThrow();

    expect(recordUsage).toHaveBeenCalledTimes(1);
    const usageRow = recordUsage.mock.calls[0][0];
    expect(usageRow.resultStatus).toBe("failure");
    expect(JSON.stringify(usageRow)).not.toContain("sensitive draft policy text");
  });
});
