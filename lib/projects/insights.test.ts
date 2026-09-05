import { describe, it, expect } from "vitest";
import { isUrgent, isNearDeadline, urgentAndUpcoming, type InsightProject } from "./insights";

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function project(overrides: Partial<InsightProject>): InsightProject {
  return {
    id: "p1",
    name: "Project",
    project_code: "OS-1",
    client_display_name: null,
    status: "active",
    health_state: "healthy",
    priority: "normal",
    target_date: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("isUrgent", () => {
  it("flags an overdue project", () => {
    expect(isUrgent(project({ target_date: iso(-1) }))).toBe(true);
  });

  it("flags a blocked project even with a distant deadline", () => {
    expect(isUrgent(project({ health_state: "blocked", target_date: iso(30) }))).toBe(true);
  });

  it("does not flag a completed project even if overdue", () => {
    expect(isUrgent(project({ status: "completed", target_date: iso(-5) }))).toBe(false);
  });

  it("does not flag a healthy project with a distant deadline", () => {
    expect(isUrgent(project({ target_date: iso(30) }))).toBe(false);
  });
});

describe("isNearDeadline", () => {
  it("is true within the badge window and false beyond it", () => {
    expect(isNearDeadline(project({ target_date: iso(2) }))).toBe(true);
    expect(isNearDeadline(project({ target_date: iso(30) }))).toBe(false);
  });

  it("is false with no target date", () => {
    expect(isNearDeadline(project({ target_date: null }))).toBe(false);
  });
});

describe("urgentAndUpcoming", () => {
  it("excludes done projects and caps at the given limit, most urgent first", () => {
    const projects = [
      project({ id: "a", target_date: iso(20) }),
      project({ id: "b", target_date: iso(-2) }),
      project({ id: "c", status: "completed", target_date: iso(-100) }),
      project({ id: "d", target_date: iso(0) }),
    ];
    const result = urgentAndUpcoming(projects, 2);
    expect(result.map((p) => p.id)).toEqual(["b", "d"]);
  });
});
