"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { createMilestoneSchema, updateMilestoneSchema } from "@/lib/validation/projects";

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

export async function createMilestone(input: unknown) {
  const parsed = createMilestoneSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: milestone, error } = await supabase
    .from("project_milestones")
    .insert({
      project_id: parsed.projectId,
      parent_milestone_id: parsed.parentMilestoneId ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      owner_id: parsed.ownerId ?? null,
      sequence: parsed.sequence,
      is_blocking: parsed.isBlocking,
      due_date: parsed.dueDate ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_milestones",
    resourceId: milestone.id,
    action: "milestone.created",
    afterState: { title: parsed.title, isBlocking: parsed.isBlocking },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "milestone.created",
    summary: `Milestone "${parsed.title}" added`,
  });

  return { milestoneId: milestone.id };
}

export async function updateMilestone(input: unknown) {
  const parsed = updateMilestoneSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.status !== undefined) updates.status = parsed.status;
  if (parsed.ownerId !== undefined) updates.owner_id = parsed.ownerId;
  if (parsed.sequence !== undefined) updates.sequence = parsed.sequence;
  if (parsed.isBlocking !== undefined) updates.is_blocking = parsed.isBlocking;
  if (parsed.dueDate !== undefined) updates.due_date = parsed.dueDate;
  if (parsed.parentMilestoneId !== undefined) {
    if (parsed.parentMilestoneId === parsed.milestoneId) {
      throw new Error("A milestone cannot be its own parent.");
    }
    updates.parent_milestone_id = parsed.parentMilestoneId;
  }
  if (parsed.status === "completed") updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("project_milestones")
    .update(updates)
    .eq("id", parsed.milestoneId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  const isCompleting = parsed.status === "completed";
  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_milestones",
    resourceId: parsed.milestoneId,
    action: isCompleting ? "milestone.completed" : "project.updated",
    afterState: updates,
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: isCompleting ? "milestone.completed" : "milestone.updated",
    summary: isCompleting ? "Milestone completed" : "Milestone updated",
  });
}
