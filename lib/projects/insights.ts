import { urgencyBucket, urgencyBadge } from "./urgency";
import type { ProjectStatus, ProjectHealthState, ProjectPriority } from "./types";

export interface InsightProject {
  id: string;
  name: string;
  project_code: string;
  client_display_name: string | null;
  status: ProjectStatus;
  health_state: ProjectHealthState;
  priority: ProjectPriority;
  target_date: string | null;
  updated_at: string;
}

const DONE_STATUSES: ProjectStatus[] = ["completed", "archived", "cancelled", "delivered"];

/** Urgent = overdue, blocked, or due within 3 days -- bucket 1/2/5 or tighter from urgency.ts. */
export function isUrgent(p: InsightProject): boolean {
  if (DONE_STATUSES.includes(p.status)) return false;
  return urgencyBucket({ status: p.status, priority: p.priority, targetDate: p.target_date, healthState: p.health_state }) <= 5;
}

export function isNearDeadline(p: InsightProject): boolean {
  if (!p.target_date || DONE_STATUSES.includes(p.status)) return false;
  const badge = urgencyBadge({ status: p.status, priority: p.priority, targetDate: p.target_date });
  return badge !== null;
}

/** Top N projects needing attention, most urgent first -- for the "Urgent & Upcoming" section. */
export function urgentAndUpcoming(projects: InsightProject[], limit = 5): InsightProject[] {
  return [...projects]
    .filter((p) => !DONE_STATUSES.includes(p.status))
    .sort(
      (a, b) =>
        urgencyBucket({ status: a.status, priority: a.priority, targetDate: a.target_date, healthState: a.health_state }) -
        urgencyBucket({ status: b.status, priority: b.priority, targetDate: b.target_date, healthState: b.health_state })
    )
    .filter((p) => isUrgent(p) || isNearDeadline(p))
    .slice(0, limit);
}
