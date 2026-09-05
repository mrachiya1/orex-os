import type { ProjectPriority, ProjectStatus } from "./types";

/**
 * The deterministic default ordering for the operational Projects view
 * (section 18): overdue, blocked, due today, due tomorrow, due within 3
 * days, high/urgent priority, remaining active, then completed/archived
 * last. Never created_at -- that tells you nothing about what needs
 * attention today. Bucket number is the sort key (ascending); ties within a
 * bucket fall back to the nearest deadline.
 */
export type UrgencyBadge = "OVERDUE" | "TODAY" | "TOMORROW" | "2 DAYS" | "THIS WEEK" | null;

export interface UrgencyInput {
  status: ProjectStatus;
  priority: ProjectPriority;
  targetDate: string | null;
  healthState?: string;
}

const DONE_STATUSES: ProjectStatus[] = ["completed", "archived", "cancelled", "delivered"];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function urgencyBadge(input: UrgencyInput): UrgencyBadge {
  if (!input.targetDate || DONE_STATUSES.includes(input.status)) return null;
  const days = daysUntil(input.targetDate);
  if (days < 0) return "OVERDUE";
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  if (days <= 3) return "2 DAYS";
  if (days <= 7) return "THIS WEEK";
  return null;
}

export function urgencyBucket(input: UrgencyInput): number {
  if (DONE_STATUSES.includes(input.status)) return 9;
  if (input.healthState === "blocked") return 2;

  const badge = urgencyBadge(input);
  if (badge === "OVERDUE") return 1;
  if (badge === "TODAY") return 3;
  if (badge === "TOMORROW") return 4;
  if (badge === "2 DAYS") return 5;
  if (input.priority === "urgent" || input.priority === "high") return 6;
  if (badge === "THIS WEEK") return 7;
  return 8;
}

export function compareByUrgency(a: UrgencyInput, b: UrgencyInput): number {
  const bucketDiff = urgencyBucket(a) - urgencyBucket(b);
  if (bucketDiff !== 0) return bucketDiff;
  if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
  if (a.targetDate) return -1;
  if (b.targetDate) return 1;
  return 0;
}
