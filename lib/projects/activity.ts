import "server-only";
import { createServiceRoleClient } from "@/lib/database/server";

export interface ProjectActivityInput {
  projectId: string;
  actorUserId: string | null;
  eventType: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * The single sanctioned way to write a project_activity row (see
 * .agents/skills/orex-rls-security/SKILL.md and prompts/004-projects-
 * delivery.md section 19). Uses the service-role client because the table
 * has no client-facing INSERT policy -- project_activity is a read-only,
 * purely operational feed, distinct from audit_logs (written separately,
 * alongside this, by the same server action) and never used as an
 * authorization source.
 */
export async function writeProjectActivity(event: ProjectActivityInput): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from("project_activity").insert({
    project_id: event.projectId,
    actor_user_id: event.actorUserId,
    event_type: event.eventType,
    summary: event.summary,
    metadata: event.metadata ?? null,
  });

  if (error) {
    console.error("Failed to write project_activity row", {
      projectId: event.projectId,
      eventType: event.eventType,
      message: error.message,
    });
  }
}
