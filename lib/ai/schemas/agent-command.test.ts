import { describe, it, expect } from "vitest";
import { agentCommandWireSchema, toAgentCommandResult } from "./agent-command";

describe("agentCommandWireSchema", () => {
  it("accepts a fully-populated wire object with unused fields set to null", () => {
    const result = agentCommandWireSchema.safeParse({
      kind: "answer",
      answer: "We do X.",
      citedSources: [],
      tool: null,
      projectNameHint: null,
      title: null,
      priority: null,
      dueDate: null,
      question: null,
      tasks: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing a required field (no field may be omitted, only null)", () => {
    const result = agentCommandWireSchema.safeParse({
      kind: "answer",
      answer: "We do X.",
      // citedSources omitted entirely
      tool: null,
      projectNameHint: null,
      title: null,
      priority: null,
      dueDate: null,
      question: null,
      tasks: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("toAgentCommandResult", () => {
  it("maps an answer wire object to the semantic AgentCommandResult", () => {
    const result = toAgentCommandResult({
      kind: "answer",
      answer: "We do X.",
      citedSources: [{ knowledgeItemId: "11111111-1111-4111-8111-111111111111", title: "Fact" }],
      tool: null,
      projectNameHint: null,
      title: null,
      priority: null,
      dueDate: null,
      question: null,
      tasks: null,
    });
    expect(result).toEqual({
      kind: "answer",
      answer: "We do X.",
      citedSources: [{ knowledgeItemId: "11111111-1111-4111-8111-111111111111", title: "Fact" }],
    });
  });

  it("defaults a null citedSources to an empty array", () => {
    const result = toAgentCommandResult({
      kind: "answer",
      answer: "We do X.",
      citedSources: null,
      tool: null,
      projectNameHint: null,
      title: null,
      priority: null,
      dueDate: null,
      question: null,
      tasks: null,
    });
    if (result.kind === "answer") expect(result.citedSources).toEqual([]);
    else throw new Error("expected kind answer");
  });

  it("maps a tool_call wire object, dropping optional-but-absent priority/dueDate", () => {
    const result = toAgentCommandResult({
      kind: "tool_call",
      answer: null,
      citedSources: null,
      tool: "projects.task.create",
      projectNameHint: "IRWAY",
      title: "Send final renders",
      priority: null,
      dueDate: null,
      question: null,
      tasks: null,
    });
    expect(result).toEqual({
      kind: "tool_call",
      tool: "projects.task.create",
      projectNameHint: "IRWAY",
      title: "Send final renders",
      priority: undefined,
      dueDate: undefined,
    });
  });

  it("maps a needs_clarification wire object", () => {
    const result = toAgentCommandResult({
      kind: "needs_clarification",
      answer: null,
      citedSources: null,
      tool: null,
      projectNameHint: null,
      title: null,
      priority: null,
      dueDate: null,
      question: "Which project did you mean?",
      tasks: null,
    });
    expect(result).toEqual({ kind: "needs_clarification", question: "Which project did you mean?" });
  });

  it("throws AIGatewayError (never a raw ZodError) when the model said answer but left answer null", () => {
    expect(() =>
      toAgentCommandResult({
        kind: "answer",
        answer: null,
        citedSources: null,
        tool: null,
        projectNameHint: null,
        title: null,
        priority: null,
        dueDate: null,
        question: null,
        tasks: null,
      })
    ).toThrowError(/did not match the expected schema/);
  });

  it("throws when a tool_call is missing its required title", () => {
    expect(() =>
      toAgentCommandResult({
        kind: "tool_call",
        answer: null,
        citedSources: null,
        tool: "projects.task.create",
        projectNameHint: "IRWAY",
        title: null,
        priority: null,
        dueDate: null,
        question: null,
        tasks: null,
      })
    ).toThrow();
  });

  it("maps a batch_task_import wire object into an array of tasks", () => {
    const result = toAgentCommandResult({
      kind: "batch_task_import",
      answer: null,
      citedSources: null,
      tool: null,
      projectNameHint: "Orextic Website",
      title: null,
      priority: null,
      dueDate: null,
      question: null,
      tasks: [
        { title: "Design homepage", priority: "high", dueDate: null },
        { title: "Write copy", priority: null, dueDate: "2026-09-10" },
      ],
    });
    expect(result).toEqual({
      kind: "batch_task_import",
      projectNameHint: "Orextic Website",
      tasks: [
        { title: "Design homepage", priority: "high", dueDate: undefined },
        { title: "Write copy", priority: undefined, dueDate: "2026-09-10" },
      ],
    });
  });

  it("SECURITY: rejects a batch of more than 50 tasks (no unlimited AI-created rows)", () => {
    const tasks = Array.from({ length: 51 }, (_, i) => ({ title: `Task ${i}`, priority: null, dueDate: null }));
    expect(() =>
      toAgentCommandResult({
        kind: "batch_task_import",
        answer: null,
        citedSources: null,
        tool: null,
        projectNameHint: "Orextic Website",
        title: null,
        priority: null,
        dueDate: null,
        question: null,
        tasks,
      })
    ).toThrow();
  });

  it("throws when batch_task_import has zero tasks", () => {
    expect(() =>
      toAgentCommandResult({
        kind: "batch_task_import",
        answer: null,
        citedSources: null,
        tool: null,
        projectNameHint: "Orextic Website",
        title: null,
        priority: null,
        dueDate: null,
        question: null,
        tasks: [],
      })
    ).toThrow();
  });
});
