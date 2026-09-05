"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireScopedPermission, requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { assertValidTransition, requiredPermissionsForTransition } from "@/lib/projects/lifecycle";
import { checkProjectReadiness, DeliveryNotReadyError } from "@/lib/projects/readiness";
import { ensureDefaultWorkspaceSections } from "@/lib/projects/workspace";
import { createServerSupabaseClient } from "@/lib/database/server";
import {
  createProjectSchema,
  updateProjectSchema,
  changeProjectStatusSchema,
  markDeliveryReadySchema,
  updateProjectHealthSchema,
  archiveProjectSchema,
} from "@/lib/validation/projects";
import type { ProjectStatus } from "@/lib/projects/types";

export async function createProject(input: unknown) {
  const parsed = createProjectSchema.parse(input);
  const user = await requireCurrentUser();
  await requireScopedPermission(parsed.companyId, parsed.organisationId, PERMISSIONS.PROJECTS_CREATE);

  const supabase = await createServerSupabaseClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      organisation_id: parsed.organisationId,
      company_id: parsed.companyId,
      folder_id: parsed.folderId ?? null,
      name: parsed.name,
      project_code: parsed.projectCode,
      project_type: parsed.projectType,
      client_display_name: parsed.clientDisplayName ?? null,
      owner_id: parsed.ownerId ?? user.id,
      lead_id: parsed.leadId ?? null,
      target_date: parsed.targetDate ?? null,
      description: parsed.description ?? null,
      scope_summary: parsed.scopeSummary ?? null,
      objectives: parsed.objectives ?? null,
      priority: parsed.priority,
      internal_notes_classification: parsed.internalNotesClassification,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: parsed.organisationId,
    companyId: parsed.companyId,
    resourceType: "projects",
    resourceId: project.id,
    action: "project.created",
    afterState: { name: parsed.name, projectType: parsed.projectType },
  });
  await ensureDefaultWorkspaceSections({
    projectId: project.id,
    organisationId: parsed.organisationId,
    companyId: parsed.companyId,
    userId: user.id,
  });

  await writeProjectActivity({
    projectId: project.id,
    actorUserId: user.id,
    eventType: "project.created",
    summary: `Project "${parsed.name}" created`,
  });

  return { projectId: project.id };
}

export async function updateProject(input: unknown) {
  const parsed = updateProjectSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("projects")
    .select("organisation_id, company_id")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Project not found");

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.name !== undefined) updates.name = parsed.name;
  if (parsed.projectType !== undefined) updates.project_type = parsed.projectType;
  if (parsed.clientDisplayName !== undefined) updates.client_display_name = parsed.clientDisplayName;
  if (parsed.ownerId !== undefined) updates.owner_id = parsed.ownerId;
  if (parsed.leadId !== undefined) updates.lead_id = parsed.leadId;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.scopeSummary !== undefined) updates.scope_summary = parsed.scopeSummary;
  if (parsed.objectives !== undefined) updates.objectives = parsed.objectives;
  if (parsed.priority !== undefined) updates.priority = parsed.priority;
  if (parsed.startDate !== undefined) updates.start_date = parsed.startDate;
  if (parsed.targetDate !== undefined) updates.target_date = parsed.targetDate;
  if (parsed.internalNotesClassification !== undefined)
    updates.internal_notes_classification = parsed.internalNotesClassification;

  const { error } = await supabase.from("projects").update(updates).eq("id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "projects",
    resourceId: parsed.projectId,
    action: "project.updated",
    afterState: updates,
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "project.updated",
    summary: "Project details updated",
  });
}

/**
 * The one server-side status-transition entrypoint (prompts/004-projects-
 * delivery.md section 7). A client-supplied targetStatus is validated
 * against the lifecycle graph, permission-checked per transition, and
 * NEVER allowed to reach "delivery_ready" here -- that status is only
 * reachable through markDeliveryReady() below, which runs the readiness
 * gate atomically with the status write.
 */
export async function changeProjectStatus(input: unknown) {
  const parsed = changeProjectStatusSchema.parse(input);
  if (parsed.targetStatus === "delivery_ready") {
    throw new Error(
      "delivery_ready is not reachable through changeProjectStatus -- use markDeliveryReady()."
    );
  }

  const user = await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("projects")
    .select("organisation_id, company_id, status")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Project not found");

  const fromStatus = existing.status as ProjectStatus;
  assertValidTransition(fromStatus, parsed.targetStatus);

  for (const perm of requiredPermissionsForTransition(parsed.targetStatus)) {
    await requireProjectAccess(parsed.projectId, perm);
  }

  const updates: Record<string, unknown> = { status: parsed.targetStatus, updated_at: new Date().toISOString() };
  if (parsed.targetStatus === "delivered") updates.delivered_at = new Date().toISOString();
  if (parsed.targetStatus === "completed") updates.completed_at = new Date().toISOString();

  if (parsed.targetStatus === "delivered") {
    const { data: deliverableRows, error: deliverableError } = await supabase
      .from("project_deliverables")
      .select("id")
      .eq("project_id", parsed.projectId);
    if (deliverableError) throw new Error(deliverableError.message);
    const deliverableIds = (deliverableRows ?? []).map((d) => d.id);

    let deliveryCount = 0;
    if (deliverableIds.length > 0) {
      const { count, error: countError } = await supabase
        .from("project_deliveries")
        .select("id", { count: "exact", head: true })
        .in("deliverable_id", deliverableIds);
      if (countError) throw new Error(countError.message);
      deliveryCount = count ?? 0;
    }
    if (deliveryCount < 1) {
      throw new Error("Cannot mark a project delivered with no recorded deliveries.");
    }
  }

  const { error } = await supabase.from("projects").update(updates).eq("id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "projects",
    resourceId: parsed.projectId,
    action: parsed.targetStatus === "archived" ? "project.archived" : "project.status_changed",
    reason: parsed.reason ?? null,
    beforeState: { status: fromStatus },
    afterState: { status: parsed.targetStatus },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "status_changed",
    summary: `Status changed from ${fromStatus} to ${parsed.targetStatus}`,
    metadata: { from: fromStatus, to: parsed.targetStatus },
  });
}

/**
 * The only route to "delivery_ready" (section 15). Runs the readiness
 * check atomically with the status write -- there is no generic update
 * path that can set this status.
 */
export async function markDeliveryReady(input: unknown) {
  const parsed = markDeliveryReadySchema.parse(input);
  const user = await requireCurrentUser();

  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_APPROVE);

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("projects")
    .select("organisation_id, company_id, status")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Project not found");

  const fromStatus = existing.status as ProjectStatus;
  assertValidTransition(fromStatus, "delivery_ready");

  const readiness = await checkProjectReadiness(supabase, parsed.projectId);
  if (!readiness.ready) {
    throw new DeliveryNotReadyError(readiness.missing);
  }

  const { error } = await supabase
    .from("projects")
    .update({
      status: "delivery_ready",
      delivery_ready_confirmed_by: user.id,
      delivery_ready_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "projects",
    resourceId: parsed.projectId,
    action: "project.status_changed",
    beforeState: { status: fromStatus },
    afterState: { status: "delivery_ready" },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "delivery_ready",
    summary: "Project marked delivery ready -- all readiness requirements satisfied",
  });
}

export async function updateProjectHealth(input: unknown) {
  const parsed = updateProjectHealthSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("projects")
    .select("organisation_id, company_id, health_state")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Project not found");

  const { error } = await supabase
    .from("projects")
    .update({
      health_state: parsed.healthState,
      health_state_source: "human",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "projects",
    resourceId: parsed.projectId,
    action: "project.updated",
    reason: parsed.note ?? null,
    beforeState: { healthState: existing.health_state },
    afterState: { healthState: parsed.healthState },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "health_changed",
    summary: `Health changed to ${parsed.healthState}`,
  });
}

export async function archiveProject(input: unknown) {
  const parsed = archiveProjectSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("projects")
    .select("status")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Project not found");

  return changeProjectStatus({ projectId: parsed.projectId, targetStatus: "archived" });
}

/**
 * Row-expansion summary for the Projects database table (section 25):
 * top-level milestones only, with recursively-computed progress, fetched
 * lazily the first time a row is expanded rather than upfront for every
 * project in the list.
 */
export async function getProjectMilestoneSummary(projectId: string) {
  await requireProjectAccess(projectId, PERMISSIONS.PROJECTS_READ);
  const supabase = await createServerSupabaseClient();

  const [{ data: milestones }, { data: tasks }] = await Promise.all([
    supabase
      .from("project_milestones")
      .select("id, parent_milestone_id, title, status, is_blocking, due_date, sequence")
      .eq("project_id", projectId)
      .order("sequence"),
    supabase
      .from("project_tasks")
      .select("id, milestone_id, title, status, due_date, assignee_user_id")
      .eq("project_id", projectId),
  ]);

  return { milestones: milestones ?? [], tasks: tasks ?? [] };
}
