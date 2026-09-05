import type { ProjectStatus, ProjectHealthState } from "@/lib/projects/types";

const STATUS_TONE: Record<ProjectStatus, string> = {
  draft: "ox-pill-neutral",
  planned: "ox-pill-neutral",
  active: "ox-pill-success",
  on_hold: "ox-pill-warning",
  review: "ox-pill-info",
  delivery_ready: "ox-pill-success",
  delivered: "ox-pill-success",
  completed: "ox-pill-neutral",
  cancelled: "ox-pill-danger",
  archived: "ox-pill-neutral",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`ox-pill ${STATUS_TONE[status]}`}>{status.replace(/_/g, " ")}</span>;
}

const HEALTH_TONE: Record<ProjectHealthState, string> = {
  healthy: "ox-pill-success",
  attention: "ox-pill-warning",
  at_risk: "ox-pill-warning",
  blocked: "ox-pill-danger",
};

export function HealthBadge({ health }: { health: ProjectHealthState }) {
  return <span className={`ox-pill ${HEALTH_TONE[health]}`}>{health.replace(/_/g, " ")}</span>;
}
