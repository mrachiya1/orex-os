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

  it("answers a bare greeting locally, without calling retrieval or the AI at all", async () => {
    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "Hi" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("answer");
      if (result.kind === "answer") expect(result.answer).toMatch(/Company Brain is ready/i);
    }
    expect(retrieveKnowledge).not.toHaveBeenCalled();
    expect(requestAI).not.toHaveBeenCalled();
  });

  it("does not treat a message that merely starts with a greeting word as a bare greeting", async () => {
    requestAI.mockResolvedValue({ data: { kind: "answer", answer: "Sure, here you go.", citedSources: [] } });

    await runCompanyBrainCommand({ organisationId, companyId, question: "Hi, can you add a task to IRWAY?" });

    expect(requestAI).toHaveBeenCalledTimes(1);
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

  it("REGRESSION (production failure): a pasted checklist classified as batch_task_import resolves the project once and proposes a single batch tool call, not one call per task", async () => {
    requestAI.mockResolvedValue({
      data: {
        kind: "batch_task_import",
        projectNameHint: "Orextic Website",
        tasks: [
          { title: "Design homepage" },
          { title: "Write copy", priority: "high" },
          { title: "QA pass", dueDate: "2026-09-10" },
        ],
      },
    });
    executeTool.mockImplementation((toolName: string) => {
      if (toolName === "projects.search") {
        return Promise.resolve({ ok: true, status: "executed", output: [{ id: "proj-1", name: "Orextic Website" }] });
      }
      return Promise.resolve({ ok: true, status: "pending_approval", requestId: "req-batch-1" });
    });

    const result = await runCompanyBrainCommand({
      organisationId,
      companyId,
      question: "- Design homepage\n- Write copy\n- QA pass\n\nAdd this task to my system",
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.kind === "action_proposed") {
      expect(result.toolName).toBe("projects.tasks.create_batch");
      expect(result.summary).toContain("3 tasks");
      expect(result.summary).toContain("Orextic Website");
      expect(result.requestId).toBe("req-batch-1");
    } else {
      throw new Error("expected an action_proposed batch result");
    }
    // Exactly 2 calls total: one to resolve the project, one to propose the
    // WHOLE batch -- never one OpenRouter/tool call per task.
    expect(executeTool).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      "projects.tasks.create_batch",
      expect.objectContaining({
        projectId: "proj-1",
        tasks: [
          { title: "Design homepage", priority: "normal", dueDate: undefined },
          { title: "Write copy", priority: "high", dueDate: undefined },
          { title: "QA pass", priority: "normal", dueDate: "2026-09-10" },
        ],
      }),
      "advisor"
    );
  });

  it("asks for clarification for a batch import when the project is ambiguous, without creating anything", async () => {
    requestAI.mockResolvedValue({
      data: { kind: "batch_task_import", projectNameHint: "Website", tasks: [{ title: "a" }, { title: "b" }] },
    });
    executeTool.mockResolvedValue({
      ok: true,
      status: "executed",
      output: [
        { id: "p1", name: "Website Relaunch A" },
        { id: "p2", name: "Website Relaunch B" },
      ],
    });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "checklist for Website" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("needs_clarification");
    expect(executeTool).toHaveBeenCalledTimes(1); // never attempted the batch mutation
  });

  it("never throws when the AI call itself fails", async () => {
    requestAI.mockRejectedValue(new Error("provider unavailable"));
    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "What do we do?" });
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
