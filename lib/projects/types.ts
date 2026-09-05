export type ProjectStatus =
  | "draft"
  | "planned"
  | "active"
  | "on_hold"
  | "review"
  | "delivery_ready"
  | "delivered"
  | "completed"
  | "cancelled"
  | "archived";

export type ProjectHealthState = "healthy" | "attention" | "at_risk" | "blocked";
export type ProjectHealthSource = "human" | "system" | "ai_recommended";
export type ProjectPriority = "low" | "normal" | "high" | "urgent";

export type MilestoneStatus = "pending" | "in_progress" | "completed" | "blocked" | "skipped";
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type DeliverableStatus = "in_progress" | "internal_review" | "client_review" | "approved" | "rejected";
export type ApprovalState = "pending" | "approved" | "rejected";
export type ReadinessCheckStatus = "pending" | "complete" | "skipped";
export type ProjectMemberRole = "owner" | "lead" | "member" | "contractor";
