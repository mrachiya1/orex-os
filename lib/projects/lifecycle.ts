import "server-only";
import type { ProjectStatus } from "./types";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/catalog";
import { isValidTransition } from "./lifecycle-graph";

export { isValidTransition } from "./lifecycle-graph";

/**
 * The one server-side status-transition enforcement point (prompts/004-
 * projects-delivery.md section 7). A client-supplied target status is never
 * trusted directly -- every transition is validated here before any
 * database write, against the graph in lifecycle-graph.ts. `at_risk` is a
 * health value (lib/projects/types.ts ProjectHealthState), never a
 * lifecycle status -- it does not appear anywhere in this graph.
 */
const NON_TERMINAL_STATUSES: ProjectStatus[] = [
  "draft",
  "planned",
  "active",
  "on_hold",
  "review",
  "delivery_ready",
];

/** Transitions that require projects.approve in addition to projects.update. */
const TRUST_WEIGHTED_TARGETS: ProjectStatus[] = ["delivery_ready", "delivered", "completed"];

export function isNonTerminalStatus(status: ProjectStatus): boolean {
  return NON_TERMINAL_STATUSES.includes(status);
}

/**
 * The permissions required for a specific transition. Every transition
 * requires projects.update; delivery_ready/delivered/completed additionally
 * require projects.approve (prompts/004-projects-delivery.md section 7/22).
 * projects.delete is never returned here -- it stays completely dormant.
 */
export function requiredPermissionsForTransition(to: ProjectStatus): PermissionKey[] {
  const perms: PermissionKey[] = [PERMISSIONS.PROJECTS_UPDATE];
  if (TRUST_WEIGHTED_TARGETS.includes(to)) {
    perms.push(PERMISSIONS.PROJECTS_APPROVE);
  }
  return perms;
}

export class InvalidTransitionError extends Error {
  constructor(from: ProjectStatus, to: ProjectStatus) {
    super(`Cannot transition project from "${from}" to "${to}".`);
    this.name = "InvalidTransitionError";
  }
}

/** Throws InvalidTransitionError if the transition is not allowed. */
export function assertValidTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
