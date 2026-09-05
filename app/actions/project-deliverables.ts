"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { assertSafeReferenceUrl } from "@/lib/projects/url-safety";
import { createDeliverableSchema, updateDeliverableSchema, approveDeliverableSchema } from "@/lib/validation/projects";

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

export async function createDeliverable(input: unknown) {
  const parsed = createDeliverableSchema.parse(input);
  if (parsed.referenceUrl) assertSafeReferenceUrl(parsed.referenceUrl);

  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.DELIVERABLES_CREATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: deliverable, error } = await supabase
    .from("project_deliverables")
    .insert({
      project_id: parsed.projectId,
      title: parsed.title,
      description: parsed.description ?? null,
      deliverable_type: parsed.deliverableType,
      is_required: parsed.isRequired,
      version: parsed.version ?? null,
      due_date: parsed.dueDate ?? null,
      reference_url: parsed.referenceUrl ?? null,
      reference_note: parsed.referenceNote ?? null,
      notes: parsed.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_deliverables",
    resourceId: deliverable.id,
    action: "deliverable.created",
    afterState: { title: parsed.title, deliverableType: parsed.deliverableType },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "deliverable.created",
    summary: `Deliverable "${parsed.title}" created`,
  });

  return { deliverableId: deliverable.id };
}

export async function updateDeliverable(input: unknown) {
  const parsed = updateDeliverableSchema.parse(input);
  if (parsed.referenceUrl) assertSafeReferenceUrl(parsed.referenceUrl);

  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.DELIVERABLES_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.status !== undefined) updates.status = parsed.status;
  if (parsed.version !== undefined) updates.version = parsed.version;
  if (parsed.dueDate !== undefined) updates.due_date = parsed.dueDate;
  if (parsed.referenceUrl !== undefined) updates.reference_url = parsed.referenceUrl;
  if (parsed.referenceNote !== undefined) updates.reference_note = parsed.referenceNote;
  if (parsed.notes !== undefined) updates.notes = parsed.notes;

  const { error } = await supabase
    .from("project_deliverables")
    .update(updates)
    .eq("id", parsed.deliverableId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_deliverables",
    resourceId: parsed.deliverableId,
    action: "deliverable.updated",
    afterState: updates,
  });
}

export async function approveDeliverable(input: unknown) {
  const parsed = approveDeliverableSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.DELIVERABLES_APPROVE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_deliverables")
    .update({
      approval_state: parsed.decision,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.deliverableId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_deliverables",
    resourceId: parsed.deliverableId,
    action: "deliverable.approved",
    afterState: { approvalState: parsed.decision },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "deliverable.approved",
    summary: `Deliverable ${parsed.decision}`,
  });
}
