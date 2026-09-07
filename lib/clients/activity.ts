import "server-only";
import { createServiceRoleClient } from "@/lib/database/server";

export interface ClientActivityInput {
  clientId: string;
  companyId: string;
  actorUserId: string | null;
  eventType: string;
  summary: string;
  relatedResourceType?: string | null;
  relatedResourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * The single sanctioned way to write a client_activity row -- mirrors
 * lib/projects/activity.ts exactly. Uses the service-role client because
 * the table has no client-facing INSERT policy (append-only, read-only for
 * clients, never used as an authorization source).
 */
export async function writeClientActivity(event: ClientActivityInput): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from("client_activity").insert({
    client_id: event.clientId,
    company_id: event.companyId,
    actor_user_id: event.actorUserId,
    event_type: event.eventType,
    summary: event.summary,
    related_resource_type: event.relatedResourceType ?? null,
    related_resource_id: event.relatedResourceId ?? null,
    metadata: event.metadata ?? {},
  });

  if (error) {
    console.error("Failed to write client_activity row", {
      clientId: event.clientId,
      eventType: event.eventType,
      message: error.message,
    });
    return;
  }

  // last_interaction_at is denormalized onto clients so the list/value
  // pages never need to aggregate timeline rows just to sort by recency
  // (prompts/017 "Performance"). Best-effort -- a failure here never blocks
  // the activity write above from having already succeeded.
  const { error: touchError } = await supabase
    .from("clients")
    .update({ last_interaction_at: new Date().toISOString() })
    .eq("id", event.clientId);
  if (touchError) {
    console.error("Failed to update clients.last_interaction_at", {
      clientId: event.clientId,
      message: touchError.message,
    });
  }
}
