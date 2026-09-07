import { describe, it, expect } from "vitest";
import { computeClientHealth } from "./health";

describe("computeClientHealth", () => {
  it("returns unknown when there are no linked projects and no interaction history", () => {
    const result = computeClientHealth({
      openIssuesCount: 0,
      hasLinkedProjects: false,
      hasActiveProject: false,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: null,
    });
    expect(result.status).toBe("unknown");
  });

  it("returns strong with 0 issues, an active project, and recent interaction", () => {
    const result = computeClientHealth({
      openIssuesCount: 0,
      hasLinkedProjects: true,
      hasActiveProject: true,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: 3,
    });
    expect(result.status).toBe("strong");
  });

  it("returns healthy with 0 issues, no active project, but recent interaction", () => {
    const result = computeClientHealth({
      openIssuesCount: 0,
      hasLinkedProjects: true,
      hasActiveProject: false,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: 10,
    });
    expect(result.status).toBe("healthy");
  });

  it("returns attention with exactly 1 open issue", () => {
    const result = computeClientHealth({
      openIssuesCount: 1,
      hasLinkedProjects: true,
      hasActiveProject: true,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: 2,
    });
    expect(result.status).toBe("attention");
    expect(result.reasons).toContain("1 open relationship issue");
  });

  it("returns attention when a linked project is at risk", () => {
    const result = computeClientHealth({
      openIssuesCount: 0,
      hasLinkedProjects: true,
      hasActiveProject: true,
      hasAtRiskProject: true,
      hasBlockedProject: false,
      daysSinceLastInteraction: 2,
    });
    expect(result.status).toBe("attention");
  });

  it("returns at_risk with 2+ open issues", () => {
    const result = computeClientHealth({
      openIssuesCount: 2,
      hasLinkedProjects: true,
      hasActiveProject: true,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: 1,
    });
    expect(result.status).toBe("at_risk");
    expect(result.reasons).toContain("2 open relationship issues");
  });

  it("returns at_risk when a linked project is blocked", () => {
    const result = computeClientHealth({
      openIssuesCount: 0,
      hasLinkedProjects: true,
      hasActiveProject: true,
      hasAtRiskProject: false,
      hasBlockedProject: true,
      daysSinceLastInteraction: 1,
    });
    expect(result.status).toBe("at_risk");
  });

  it("returns at_risk when stale (>21 days) with an active project", () => {
    const result = computeClientHealth({
      openIssuesCount: 0,
      hasLinkedProjects: true,
      hasActiveProject: true,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: 30,
    });
    expect(result.status).toBe("at_risk");
  });

  it("never treats a single event as at_risk on its own (0 issues, no at-risk/blocked project, mid-range interaction => attention not at_risk)", () => {
    const result = computeClientHealth({
      openIssuesCount: 0,
      hasLinkedProjects: true,
      hasActiveProject: true,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: 15,
    });
    expect(result.status).toBe("attention");
  });

  it("always includes a Why reasons list for non-strong/healthy statuses", () => {
    const result = computeClientHealth({
      openIssuesCount: 2,
      hasLinkedProjects: true,
      hasActiveProject: true,
      hasAtRiskProject: false,
      hasBlockedProject: false,
      daysSinceLastInteraction: 25,
    });
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
