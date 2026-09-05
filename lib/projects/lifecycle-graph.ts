import type { ProjectStatus } from "./types";

/**
 * The status-transition graph, shared between server-side enforcement
 * (lib/projects/lifecycle.ts, which re-exports this) and client-side UI that
 * needs to know which options to *offer* (StatusActions, the Projects table's
 * inline status popover). Deliberately has no "server-only" import so both
 * sides can read the same data instead of maintaining two copies -- the
 * actual enforcement still only ever happens in changeProjectStatus() on the
 * server, which re-validates independently of whatever the client sent.
 */
export const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["active", "cancelled"],
  active: ["on_hold", "review", "delivery_ready", "cancelled"],
  on_hold: ["active", "cancelled"],
  review: ["active", "delivery_ready", "cancelled"],
  delivery_ready: ["delivered", "cancelled"],
  delivered: ["completed"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

export function isValidTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
