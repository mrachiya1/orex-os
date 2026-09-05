import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  assertValidTransition,
  requiredPermissionsForTransition,
  InvalidTransitionError,
} from "./lifecycle";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { ProjectStatus } from "./types";

describe("project lifecycle", () => {
  const validCases: Array<[ProjectStatus, ProjectStatus]> = [
    ["draft", "planned"],
    ["planned", "active"],
    ["active", "on_hold"],
    ["on_hold", "active"],
    ["active", "review"],
    ["review", "active"],
    ["active", "delivery_ready"],
    ["review", "delivery_ready"],
    ["delivery_ready", "delivered"],
    ["delivered", "completed"],
    ["active", "cancelled"],
    ["draft", "cancelled"],
    ["completed", "archived"],
    ["cancelled", "archived"],
  ];

  it.each(validCases)("allows %s -> %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  const invalidCases: Array<[ProjectStatus, ProjectStatus]> = [
    ["draft", "active"], // skips planned
    ["draft", "delivery_ready"],
    ["archived", "active"], // terminal
    ["completed", "active"],
    ["delivered", "delivery_ready"], // backward
    ["cancelled", "active"], // no recovery from cancelled
  ];

  it.each(invalidCases)("rejects %s -> %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
    expect(() => assertValidTransition(from, to)).toThrow(InvalidTransitionError);
  });

  it("never treats at_risk as a lifecycle status", () => {
    const allStatuses = Object.values({
      draft: 1, planned: 1, active: 1, on_hold: 1, review: 1,
      delivery_ready: 1, delivered: 1, completed: 1, cancelled: 1, archived: 1,
    });
    expect(allStatuses.length).toBe(10);
    // @ts-expect-error -- at_risk is a health value, not a valid ProjectStatus
    expect(isValidTransition("active", "at_risk")).toBe(false);
  });

  it("requires only projects.update for an ordinary transition", () => {
    expect(requiredPermissionsForTransition("planned")).toEqual([PERMISSIONS.PROJECTS_UPDATE]);
    expect(requiredPermissionsForTransition("on_hold")).toEqual([PERMISSIONS.PROJECTS_UPDATE]);
    expect(requiredPermissionsForTransition("archived")).toEqual([PERMISSIONS.PROJECTS_UPDATE]);
  });

  it("requires projects.update AND projects.approve for the three trust-weighted transitions", () => {
    for (const target of ["delivery_ready", "delivered", "completed"] as ProjectStatus[]) {
      const perms = requiredPermissionsForTransition(target);
      expect(perms).toContain(PERMISSIONS.PROJECTS_UPDATE);
      expect(perms).toContain(PERMISSIONS.PROJECTS_APPROVE);
    }
  });

  it("never requires projects.delete for any transition, including archival", () => {
    const allTargets: ProjectStatus[] = [
      "planned", "active", "on_hold", "review", "delivery_ready",
      "delivered", "completed", "cancelled", "archived",
    ];
    for (const target of allTargets) {
      expect(requiredPermissionsForTransition(target)).not.toContain(PERMISSIONS.PROJECTS_DELETE);
    }
  });
});
