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
      })
    ).toThrow();
  });
});
