import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const hasPermission = vi.fn();
const writeAuditLog = vi.fn();
const routeAndCall = vi.fn();
const recordUsage = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a) }));
vi.mock("@/lib/permissions", () => ({
  hasPermission: (...a: unknown[]) => hasPermission(...a),
  PERMISSIONS: { AI_USE: "ai.use" },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("./router", () => ({ routeAndCall: (...a: unknown[]) => routeAndCall(...a) }));
vi.mock("./usage", () => ({ recordUsage: (...a: unknown[]) => recordUsage(...a) }));

const { requestAI } = await import("./gateway");
const { AIGatewayError } = await import("./errors");

const baseParams = {
  alias: "ops.fast",
  companyId: "11111111-1111-4111-8111-111111111111",
  systemPrompt: "system",
  userPrompt: "user",
  context: { fields: [], allowConfidential: false, allowRestricted: false },
};

describe("requestAI", () => {
  beforeEach(() => {
    requireCurrentUser.mockReset();
    hasPermission.mockReset();
    writeAuditLog.mockReset();
    routeAndCall.mockReset();
    recordUsage.mockReset();
  });

  it("denies an unauthenticated request before any context or model call", async () => {
    requireCurrentUser.mockRejectedValue(new Error("Not authenticated"));

    await expect(requestAI(baseParams)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(hasPermission).not.toHaveBeenCalled();
    expect(routeAndCall).not.toHaveBeenCalled();
    // No real actor exists, so no usage row is written for this case.
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("rejects an unknown task alias without calling the model", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });

    await expect(requestAI({ ...baseParams, alias: "not.a.real.alias" })).rejects.toMatchObject({
      code: "UNKNOWN_TASK_ALIAS",
    });
    expect(routeAndCall).not.toHaveBeenCalled();
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(recordUsage.mock.calls[0][0]).toMatchObject({ resultStatus: "failure" });
  });

  it("denies a request for a company the user lacks ai.use for, and audits it", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(false);

    await expect(requestAI(baseParams)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    expect(writeAuditLog.mock.calls[0][0]).toMatchObject({
      action: "ai_request.permission_denied",
      resultStatus: "failure",
    });
    expect(routeAndCall).not.toHaveBeenCalled();
    expect(recordUsage).toHaveBeenCalledTimes(1);
  });

  it("never lets a client-supplied companyId bypass the permission check", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(false);

    await expect(
      requestAI({ ...baseParams, companyId: "forged-company-id" })
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(hasPermission).toHaveBeenCalledWith("forged-company-id", "ai.use");
  });

  it("returns a successful result and records a success usage event", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(true);
    routeAndCall.mockResolvedValue({
      content: "the answer",
      requestedModel: "openai/gpt-5.4-mini",
      actualModel: "openai/gpt-5.4-mini",
      provider: "openai",
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cost: 0.001,
    });

    const result = await requestAI(baseParams);

    expect(result.data).toBe("the answer");
    expect(result.actualModel).toBe("openai/gpt-5.4-mini");
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(recordUsage.mock.calls[0][0]).toMatchObject({
      resultStatus: "success",
      taskAlias: "ops.fast",
      totalTokens: 15,
    });
  });

  it("records a failure usage event when the model call throws", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(true);
    routeAndCall.mockRejectedValue(new AIGatewayError("FALLBACK_EXHAUSTED", "no models available"));

    await expect(requestAI(baseParams)).rejects.toMatchObject({ code: "FALLBACK_EXHAUSTED" });
    expect(recordUsage.mock.calls[0][0]).toMatchObject({
      resultStatus: "failure",
      errorClassification: "FALLBACK_EXHAUSTED",
    });
  });

  it("treats a model refusal as a distinct, non-retried failure", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(true);
    routeAndCall.mockResolvedValue({
      content: "",
      requestedModel: "openai/gpt-5-mini",
      actualModel: "openai/gpt-5-mini",
      provider: "openai",
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      cost: 0,
      toolCalls: [],
      finishReason: "content_filter",
      refusal: "I can't help with that.",
    });

    await expect(requestAI(baseParams)).rejects.toMatchObject({ code: "MODEL_REFUSAL" });
    expect(routeAndCall).toHaveBeenCalledTimes(1); // never retried a refusal
  });

  it("retries exactly once on empty content when a schema is required, then succeeds", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(true);
    const schema = (await import("zod")).z.object({ ok: (await import("zod")).z.literal(true) });
    routeAndCall
      .mockResolvedValueOnce({
        content: "",
        requestedModel: "openai/gpt-5-mini",
        actualModel: "openai/gpt-5-mini",
        provider: "openai",
        inputTokens: 1,
        outputTokens: 0,
        totalTokens: 1,
        cost: 0,
        toolCalls: [],
        finishReason: "stop",
        refusal: null,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ ok: true }),
        requestedModel: "openai/gpt-5-mini",
        actualModel: "openai/gpt-5-mini",
        provider: "openai",
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        cost: 0,
        toolCalls: [],
        finishReason: "stop",
        refusal: null,
      });

    const result = await requestAI({ ...baseParams, schema, schemaName: "ok_schema" });

    expect(result.data).toEqual({ ok: true });
    expect(routeAndCall).toHaveBeenCalledTimes(2);
  });

  it("retries exactly once on malformed JSON, then gives up cleanly (never a third attempt)", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(true);
    const schema = (await import("zod")).z.object({ ok: (await import("zod")).z.literal(true) });
    routeAndCall.mockResolvedValue({
      content: "not json at all",
      requestedModel: "openai/gpt-5-mini",
      actualModel: "openai/gpt-5-mini",
      provider: "openai",
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      cost: 0,
      toolCalls: [],
      finishReason: "stop",
      refusal: null,
    });

    await expect(requestAI({ ...baseParams, schema, schemaName: "ok_schema" })).rejects.toMatchObject({
      code: "INVALID_STRUCTURED_OUTPUT",
    });
    expect(routeAndCall).toHaveBeenCalledTimes(2); // one retry, then stop
  });

  it("REGRESSION (production failure): finishReason=length is reported as OUTPUT_TRUNCATED, never retried, and never as a generic 'unexpected response' -- e.g. a large pasted checklist that ran out of output tokens", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(true);
    const schema = (await import("zod")).z.object({ ok: (await import("zod")).z.literal(true) });
    routeAndCall.mockResolvedValue({
      content: '{"ok": true, "incomplete_because_trunc', // truncated mid-JSON
      requestedModel: "openai/gpt-5-mini",
      actualModel: "openai/gpt-5-mini",
      provider: "openai",
      inputTokens: 500,
      outputTokens: 4096,
      totalTokens: 4596,
      cost: 0.01,
      toolCalls: [],
      finishReason: "length",
      refusal: null,
    });

    await expect(requestAI({ ...baseParams, schema, schemaName: "ok_schema" })).rejects.toMatchObject({
      code: "OUTPUT_TRUNCATED",
    });
    expect(routeAndCall).toHaveBeenCalledTimes(1); // not retried -- the same oversized request would truncate again
  });

  it("records a TASK_SENSITIVITY_REJECTED failure with no request content in the usage row", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    hasPermission.mockResolvedValue(true);
    routeAndCall.mockRejectedValue(
      new AIGatewayError("TASK_SENSITIVITY_REJECTED", 'Task "ops.fast" does not allow restricted-classified data.')
    );

    await expect(requestAI(baseParams)).rejects.toMatchObject({ code: "TASK_SENSITIVITY_REJECTED" });
    const usageRow = recordUsage.mock.calls[0][0];
    expect(usageRow).toMatchObject({ resultStatus: "failure", errorClassification: "TASK_SENSITIVITY_REJECTED" });
    // The usage row never carries prompt/response content -- only the fixed
    // set of operational metadata fields (lib/ai/usage.ts UsageEventInput).
    expect(Object.keys(usageRow).sort()).toEqual(
      [
        "actorUserId",
        "organisationId",
        "companyId",
        "agentId",
        "agentRunId",
        "taskAlias",
        "requestedModel",
        "actualModel",
        "provider",
        "inputTokens",
        "outputTokens",
        "totalTokens",
        "estimatedCost",
        "latencyMs",
        "resultStatus",
        "promptVersion",
        "errorClassification",
      ].sort()
    );
  });
});
