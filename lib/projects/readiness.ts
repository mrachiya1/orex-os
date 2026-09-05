import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The delivery-ready gate (prompts/004-projects-delivery.md section 15).
 * Checked atomically as part of markDeliveryReady() -- never a separate
 * step a client could race past. Every failure is enumerated, never just
 * "no" -- the server action returns a typed, specific explanation of what's
 * still missing.
 */

export interface ReadinessFailure {
  type: "readiness_check" | "milestone" | "scope_change" | "deliverable";
  id: string;
  title: string;
}

export interface ReadinessResult {
  ready: boolean;
  missing: ReadinessFailure[];
}

export async function checkProjectReadiness(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string
): Promise<ReadinessResult> {
  const [checksRes, milestonesRes, scopeChangesRes, deliverablesRes] = await Promise.all([
    supabase
      .from("project_readiness_checks")
      .select("id, title, is_required, status")
      .eq("project_id", projectId)
      .eq("is_required", true)
      .neq("status", "complete"),
    supabase
      .from("project_milestones")
      .select("id, title, is_blocking, status")
      .eq("project_id", projectId)
      .eq("is_blocking", true)
      .neq("status", "completed"),
    supabase
      .from("project_scope_changes")
      .select("id, summary, is_blocking, approval_state")
      .eq("project_id", projectId)
      .eq("is_blocking", true)
      .eq("approval_state", "pending"),
    supabase
      .from("project_deliverables")
      .select("id, title, is_required, approval_state")
      .eq("project_id", projectId)
      .eq("is_required", true)
      .neq("approval_state", "approved"),
  ]);

  for (const res of [checksRes, milestonesRes, scopeChangesRes, deliverablesRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const missing: ReadinessFailure[] = [
    ...(checksRes.data ?? []).map((r) => ({ type: "readiness_check" as const, id: r.id, title: r.title })),
    ...(milestonesRes.data ?? []).map((r) => ({ type: "milestone" as const, id: r.id, title: r.title })),
    ...(scopeChangesRes.data ?? []).map((r) => ({ type: "scope_change" as const, id: r.id, title: r.summary })),
    ...(deliverablesRes.data ?? []).map((r) => ({ type: "deliverable" as const, id: r.id, title: r.title })),
  ];

  return { ready: missing.length === 0, missing };
}

export class DeliveryNotReadyError extends Error {
  readonly missing: ReadinessFailure[];
  constructor(missing: ReadinessFailure[]) {
    super(
      `Project is not ready for delivery: ${missing.length} outstanding requirement(s) -- ${missing
        .map((m) => `${m.type}:${m.title}`)
        .join(", ")}`
    );
    this.name = "DeliveryNotReadyError";
    this.missing = missing;
  }
}
