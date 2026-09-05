import { describe, it, expect } from "vitest";
import { chunkKnowledgeContent } from "./chunking";

describe("chunkKnowledgeContent", () => {
  it("never chunks an atomic fact", () => {
    const chunks = chunkKnowledgeContent("fact", "Our standard hourly rate is $150.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toBe("Our standard hourly rate is $150.");
  });

  it("splits a short document into one chunk per paragraph when small", () => {
    const content = "First principle.\n\nSecond principle.\n\nThird principle.";
    const chunks = chunkKnowledgeContent("document", content);
    // Small enough to fit in a single chunk together -- still one chunk index 0.
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].content).toContain("First principle.");
  });

  it("splits long prose into multiple chunks targeting the token range", () => {
    const paragraph = "This is a sentence about our company strategy and operations. ".repeat(40);
    const content = Array.from({ length: 6 }, () => paragraph).join("\n\n");
    const chunks = chunkKnowledgeContent("strategy", content);
    expect(chunks.length).toBeGreaterThan(1);
    // No chunk should vastly exceed the ~650 token (~2600 char) target.
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(2600 + 400);
    }
  });

  it("splits SOPs by logical process step when steps are detected", () => {
    const content = [
      "Step 1: Receive the client brief.",
      "Confirm scope and timeline with the client.",
      "Step 2: Assign the project to a lead.",
      "Notify the assigned lead via the team channel.",
      "Step 3: Kick off the project.",
      "Schedule the kickoff call within 48 hours.",
    ].join("\n");
    const chunks = chunkKnowledgeContent("sop", content);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].content).toContain("Step 1");
  });

  it("falls back to paragraph splitting for a process with no detected steps", () => {
    const content = "Some process description.\n\nAnother paragraph about the same process.";
    const chunks = chunkKnowledgeContent("process", content);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("returns a single empty chunk for empty content rather than throwing", () => {
    const chunks = chunkKnowledgeContent("fact", "   ");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("");
  });
});
