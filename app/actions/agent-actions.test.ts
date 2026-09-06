import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const hasPermission = vi.fn();
const hasOrgPermission = vi.fn();
const retrieveKnowledge = vi.fn();
const requestAI = vi.fn();
const executeTool = vi.fn();
const approveActionRequest = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: (...a: unknown[]) => hasPermission(...a),
  hasOrgPermission: (...a: unknown[]) => hasOrgPermission(...a),
  PERMISSIONS: { KNOWLEDGE_READ: "knowledge.read", AI_USE: "ai.use" },
}));
vi.mock("@/lib/knowledge/retrieval", () => ({
  retrieveKnowledge: (...a: unknown[]) => retrieveKnowledge(...a),
}));
vi.mock("@/lib/ai/gateway", () => ({ requestAI: (...a: unknown[]) => requestAI(...a) }));
vi.mock("@/lib/ai/tools/executor", () => ({
  executeTool: (...a: unknown[]) => executeTool(...a),
  approveActionRequest: (...a: unknown[]) => approveActionRequest(...a),
}));

const { runCompanyBrainCommand, decideAgentAction } = await import("./agent-actions");

const organisationId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

describe("runCompanyBrainCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    hasPermission.mockResolvedValue(true);
    retrieveKnowledge.mockResolvedValue([]);
  });

  it("returns an answer when the model classifies the message as a question", async () => {
    requestAI.mockResolvedValue({ data: { kind: "answer", answer: "We do X.", citedSources: [] } });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "What do we do?" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("answer");
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("returns needs_clarification as-is when the model asks for it", async () => {
    requestAI.mockResolvedValue({ data: { kind: "needs_clarification", question: "Which project?" } });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "Add a task" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("needs_clarification");
  });

  it("never throws, never leaks, when the permission check denies", async () => {
    hasPermission.mockResolvedValue(false);
    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "hi" });
    expect(result.ok).toBe(false);
  });

  it("resolves a named project via projects.search, then proposes the mutation -- never guesses a projectId", async () => {
    requestAI.mockResolvedValue({
      data: { kind: "tool_call", tool: "projects.task.create", projectNameHint: "IRWAY", title: "Send final renders" },
    });
    executeTool.mockImplementation((toolName: string) => {
      if (toolName === "projects.search") {
        return Promise.resolve({ ok: true, status: "executed", output: [{ id: "proj-1", name: "IRWAY VisionPro" }] });
      }
      return Promise.resolve({ ok: true, status: "pending_approval", requestId: "req-1" });
    });

    const result = await runCompanyBrainCommand({
      organisationId,
      companyId,
      question: "Add a task to IRWAY to send final renders",
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.kind === "action_proposed") {
      expect(result.requestId).toBe("req-1");
      expect(result.summary).toContain("IRWAY VisionPro");
    } else {
      throw new Error("expected an action_proposed result");
    }
    expect(executeTool).toHaveBeenNthCalledWith(1, "projects.search", { companyId, query: "IRWAY" }, "advisor");
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      "projects.task.create",
      expect.objectContaining({ projectId: "proj-1", title: "Send final renders" }),
      "advisor"
    );
  });

  it("asks for clarification instead of guessing when zero projects match", async () => {
    requestAI.mockResolvedValue({
      data: { kind: "tool_call", tool: "projects.task.create", projectNameHint: "Nonexistent", title: "x" },
    });
    executeTool.mockResolvedValue({ ok: true, status: "executed", output: [] });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "Add a task to Nonexistent" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("needs_clarification");
    expect(executeTool).toHaveBeenCalledTimes(1); // never attempted the mutation
  });

  it("asks the user to choose instead of guessing when multiple projects match", async () => {
    requestAI.mockResolvedValue({
      data: { kind: "tool_call", tool: "projects.task.create", projectNameHint: "Website", title: "x" },
    });
    executeTool.mockResolvedValue({
      ok: true,
      status: "executed",
      output: [
        { id: "p1", name: "Website Relaunch A" },
        { id: "p2", name: "Website Relaunch B" },
      ],
    });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "Add a task to Website" });

    expect(result.ok).toBe(true);
    if (result.ok && result.kind === "needs_clarification") {
      expect(result.question).toContain("Website Relaunch A");
      expect(result.question).toContain("Website Relaunch B");
    } else {
      throw new Error("expected needs_clarification");
    }
    expect(executeTool).toHaveBeenCalledTimes(1); // never attempted the mutation
  });

  it("never throws when the AI call itself fails", async () => {
    requestAI.mockRejectedValue(new Error("provider unavailable"));
    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "hi" });
    expect(result.ok).toBe(false);
  });
});

describe("decideAgentAction", () => {
  it("delegates to approveActionRequest", async () => {
    approveActionRequest.mockResolvedValue({ ok: true, status: "executed" });
    const result = await decideAgentAction("req-1", "approved");
    expect(result.ok).toBe(true);
    expect(approveActionRequest).toHaveBeenCalledWith("req-1", "approved");
  });
});
