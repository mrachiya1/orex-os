import { describe, it, expect } from "vitest";
import { urgencyBadge, compareByUrgency } from "./urgency";

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("urgencyBadge", () => {
  it("flags an overdue project", () => {
    expect(urgencyBadge({ status: "active", priority: "normal", targetDate: iso(-2) })).toBe("OVERDUE");
  });

  it("flags due today / tomorrow / within a few days", () => {
    expect(urgencyBadge({ status: "active", priority: "normal", targetDate: iso(0) })).toBe("TODAY");
    expect(urgencyBadge({ status: "active", priority: "normal", targetDate: iso(1) })).toBe("TOMORROW");
    expect(urgencyBadge({ status: "active", priority: "normal", targetDate: iso(3) })).toBe("2 DAYS");
  });

  it("returns null for a completed project even if overdue", () => {
    expect(urgencyBadge({ status: "completed", priority: "normal", targetDate: iso(-5) })).toBeNull();
  });

  it("returns null when there is no target date", () => {
    expect(urgencyBadge({ status: "active", priority: "normal", targetDate: null })).toBeNull();
  });
});

describe("compareByUrgency", () => {
  it("orders overdue before blocked before due-today before high priority before the rest", () => {
    const overdue = { status: "active" as const, priority: "normal" as const, targetDate: iso(-1) };
    const blocked = { status: "active" as const, priority: "normal" as const, targetDate: iso(20), healthState: "blocked" };
    const dueToday = { status: "active" as const, priority: "normal" as const, targetDate: iso(0) };
    const highPriority = { status: "active" as const, priority: "urgent" as const, targetDate: null };
    const relaxed = { status: "active" as const, priority: "normal" as const, targetDate: iso(30) };

    const sorted = [relaxed, highPriority, dueToday, blocked, overdue].sort(compareByUrgency);
    expect(sorted).toEqual([overdue, blocked, dueToday, highPriority, relaxed]);
  });

  it("sorts completed/archived/cancelled projects last regardless of date", () => {
    const active = { status: "active" as const, priority: "normal" as const, targetDate: iso(10) };
    const completed = { status: "completed" as const, priority: "urgent" as const, targetDate: iso(-100) };
    expect([completed, active].sort(compareByUrgency)).toEqual([active, completed]);
  });

  it("is deterministic -- never falls back to insertion/created order alone", () => {
    const a = { status: "active" as const, priority: "normal" as const, targetDate: iso(5) };
    const b = { status: "active" as const, priority: "normal" as const, targetDate: iso(2) };
    expect([a, b].sort(compareByUrgency)).toEqual([b, a]);
  });
});
