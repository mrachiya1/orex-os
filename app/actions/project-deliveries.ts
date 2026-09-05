"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { assertSafeReferenceUrl } from "@/lib/projects/url-safety";
import { recordDeliverySchema } from "@/lib/validation/projects";

async function getProjectScope(projectId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("organisation_id, company_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found");
  return data;
}

/**
 * Requires deliverables.deliver -- "final project delivery" per the
 * founder's explicit instruction, the narrowest new permission in the
 * catalog. Inserts an append-only project_deliveries row; there is no
 * update/delete path for this table at all (no hard deletion of historical
 * delivery records).
 */
export async function recordDelivery(input: unknown) {
  const parsed = recordDeliverySchema.parse(input);
  if (parsed.referenceUrl) assertSafeReferenceUrl(parsed.referenceUrl);

  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.DELIVERABLES_DELIVER);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: deliverable, error: deliverableError } = await supabase
    .from("project_deliverables")
    .select("id, title, project_id")
    .eq("id", parsed.deliverableId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();
  if (deliverableError) throw new Error(deliverableError.message);
  if (!deliverable) throw new Error("Deliverable not found");

  const { data: delivery, error } = await supabase
    .from("project_deliveries")
    .insert({
      deliverable_id: parsed.deliverableId,
      delivered_by: user.id,
      version: parsed.version ?? null,
      destination: parsed.destination ?? null,
      reference_url: parsed.referenceUrl ?? null,
      notes: parsed.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_deliveries",
    resourceId: delivery.id,
    action: "deliverable.delivered",
    afterState: { deliverableId: parsed.deliverableId, destination: parsed.destination ?? null },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "delivered",
    summary: `Delivered "${deliverable.title}"`,
  });

  return { deliveryId: delivery.id };
}
