import type { ClientStatus, RelationshipStage } from "@/lib/clients/types";
import type { ClientHealthStatus } from "@/lib/clients/health";
import { CLIENT_HEALTH_LABELS } from "@/lib/clients/health";

const STATUS_TONE: Record<ClientStatus, string> = {
  lead: "ox-pill-neutral",
  negotiating: "ox-pill-info",
  active: "ox-pill-success",
  paused: "ox-pill-warning",
  inactive: "ox-pill-neutral",
  completed: "ox-pill-neutral",
  lost: "ox-pill-danger",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`ox-pill ${STATUS_TONE[status]}`}>{status.replace(/_/g, " ")}</span>;
}

const STAGE_TONE: Record<RelationshipStage, string> = {
  new: "ox-pill-info",
  developing: "ox-pill-info",
  established: "ox-pill-success",
  long_term: "ox-pill-success",
  at_risk: "ox-pill-warning",
  dormant: "ox-pill-neutral",
};

export function RelationshipStageBadge({ stage }: { stage: RelationshipStage }) {
  return <span className={`ox-pill ${STAGE_TONE[stage]}`}>{stage.replace(/_/g, " ")}</span>;
}

const HEALTH_TONE: Record<ClientHealthStatus, string> = {
  strong: "ox-pill-success",
  healthy: "ox-pill-success",
  attention: "ox-pill-warning",
  at_risk: "ox-pill-danger",
  unknown: "ox-pill-neutral",
};

export function ClientHealthBadge({ status }: { status: ClientHealthStatus }) {
  return <span className={`ox-pill ${HEALTH_TONE[status]}`}>{CLIENT_HEALTH_LABELS[status]}</span>;
}
