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

const EMPTY_SNAPSHOT_RESULT = { ok: true, status: "executed", output: [] };

/**
 * Every non-greeting call now also fetches a real operational snapshot
 * (projects.list_at_risk + decisions.list) before the classification call --
 * this wraps a per-test `handlers` map for the tools a test actually cares
 * about, while the snapshot tools always resolve to an empty, harmless
 * result unless a test explicitly overrides them.
 */
function mockExecuteTool(handlers: Record<string, () => Promise<unknown>> = {}) {
  executeTool.mockImplementation((toolName: string) => {
    if (toolName in handlers) return handlers[toolName]();
    if (toolName === "projects.list_at_risk" || toolName === "decisions.list") {
      return Promise.resolve(EMPTY_SNAPSHOT_RESULT);
    }
    return Promise.resolve({ ok: true, status: "pending_approval", requestId: "req-1" });
  });
}

describe("runCompanyBrainCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    hasPermission.mockResolvedValue(true);
    retrieveKnowledge.mockResolvedValue([]);
    mockExecuteTool();
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
    // A bare greeting short-circuits before even the operational snapshot fetch.
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("does not treat a message that merely starts with a greeting word as a bare greeting", async () => {
    requestAI.mockResolvedValue({ data: { kind: "answer", answer: "Sure, here you go.", citedSources: [] } });

    await runCompanyBrainCommand({ organisationId, companyId, question: "Hi, can you add a task to IRWAY?" });

    expect(requestAI).toHaveBeenCalledTimes(1);
  });

  it("fetches the real operational snapshot (at-risk projects + open decisions) before classifying, so an answer can use live data", async () => {
    requestAI.mockResolvedValue({ data: { kind: "answer", answer: "3 projects need attention.", citedSources: [] } });

    await runCompanyBrainCommand({ organisationId, companyId, question: "What needs my attention?" });

    expect(executeTool).toHaveBeenCalledWith("projects.list_at_risk", { companyId, limit: 10 }, "advisor");
    expect(executeTool).toHaveBeenCalledWith("decisions.list", { companyId, limit: 10 }, "advisor");
    const contextArg = requestAI.mock.calls[0][0].context;
    const keys = contextArg.fields.map((f: { key: string }) => f.key);
    expect(keys).toContain("at_risk_projects");
    expect(keys).toContain("open_decisions");
  });

  it("returns an answer when the model classifies the message as a question", async () => {
    requestAI.mockResolvedValue({ data: { kind: "answer", answer: "We do X.", citedSources: [] } });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "What do we do?" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("answer");
    // Only the two read-only snapshot calls -- no project resolution/mutation tool.
    expect(executeTool).toHaveBeenCalledTimes(2);
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
    mockExecuteTool({
      "projects.search": () =>
        Promise.resolve({ ok: true, status: "executed", output: [{ id: "proj-1", name: "IRWAY VisionPro" }] }),
      "projects.task.create": () => Promise.resolve({ ok: true, status: "pending_approval", requestId: "req-1" }),
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
    expect(executeTool).toHaveBeenCalledWith("projects.search", { companyId, query: "IRWAY" }, "advisor");
    expect(executeTool).toHaveBeenCalledWith(
      "projects.task.create",
      expect.objectContaining({ projectId: "proj-1", title: "Send final renders" }),
      "advisor"
    );
  });

  it("REGRESSION: asks which project instead of searching for a generic word the model guessed (e.g. 'projects') as the project name", async () => {
    requestAI.mockResolvedValue({
      data: { kind: "tool_call", tool: "projects.task.create", projectNameHint: "projects", title: "Backup code" },
    });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "Add this task to my system" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("needs_clarification");
      if (result.kind === "needs_clarification") expect(result.question).not.toContain('"projects"');
    }
    // Never calls projects.search for a generic word -- only the snapshot reads happened.
    expect(executeTool).not.toHaveBeenCalledWith("projects.search", expect.anything(), expect.anything());
  });

  it("asks for clarification instead of guessing when zero projects match", async () => {
    requestAI.mockResolvedValue({
      data: { kind: "tool_call", tool: "projects.task.create", projectNameHint: "Nonexistent", title: "x" },
    });
    mockExecuteTool({ "projects.search": () => Promise.resolve({ ok: true, status: "executed", output: [] }) });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "Add a task to Nonexistent" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("needs_clarification");
    // Snapshot (2) + projects.search (1) -- never attempted the mutation.
    expect(executeTool).toHaveBeenCalledTimes(3);
  });

  it("asks the user to choose instead of guessing when multiple projects match", async () => {
    requestAI.mockResolvedValue({
      data: { kind: "tool_call", tool: "projects.task.create", projectNameHint: "Website", title: "x" },
    });
    mockExecuteTool({
      "projects.search": () =>
        Promise.resolve({
          ok: true,
          status: "executed",
          output: [
            { id: "p1", name: "Website Relaunch A" },
            { id: "p2", name: "Website Relaunch B" },
          ],
        }),
    });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "Add a task to Website" });

    expect(result.ok).toBe(true);
    if (result.ok && result.kind === "needs_clarification") {
      expect(result.question).toContain("Website Relaunch A");
      expect(result.question).toContain("Website Relaunch B");
    } else {
      throw new Error("expected needs_clarification");
    }
    expect(executeTool).toHaveBeenCalledTimes(3); // snapshot (2) + projects.search (1), never the mutation
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
    mockExecuteTool({
      "projects.search": () =>
        Promise.resolve({ ok: true, status: "executed", output: [{ id: "proj-1", name: "Orextic Website" }] }),
      "projects.tasks.create_batch": () =>
        Promise.resolve({ ok: true, status: "pending_approval", requestId: "req-batch-1" }),
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
    // Snapshot (2) + resolve project (1) + propose the WHOLE batch (1) --
    // never one OpenRouter/tool call per task.
    expect(executeTool).toHaveBeenCalledTimes(4);
    expect(executeTool).toHaveBeenCalledWith(
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
    mockExecuteTool({
      "projects.search": () =>
        Promise.resolve({
          ok: true,
          status: "executed",
          output: [
            { id: "p1", name: "Website Relaunch A" },
            { id: "p2", name: "Website Relaunch B" },
          ],
        }),
    });

    const result = await runCompanyBrainCommand({ organisationId, companyId, question: "checklist for Website" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("needs_clarification");
    expect(executeTool).not.toHaveBeenCalledWith("projects.tasks.create_batch", expect.anything(), expect.anything());
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
