"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema } from "@/lib/validation/projects";

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

export async function createTask(input: unknown) {
  const parsed = createTaskSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: task, error } = await supabase
    .from("project_tasks")
    .insert({
      project_id: parsed.projectId,
      milestone_id: parsed.milestoneId ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      priority: parsed.priority,
      assignee_user_id: parsed.assigneeUserId ?? null,
      due_date: parsed.dueDate ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_tasks",
    resourceId: task.id,
    action: "task.created",
    afterState: { title: parsed.title },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "task.created",
    summary: `Task "${parsed.title}" created`,
  });

  return { taskId: task.id };
}

/**
 * The general update path -- requires projects.update. For a narrower,
 * assignee-only status flip, use updateTaskStatus() below instead
 * (prompts/004-projects-delivery.md section 12).
 */
export async function updateTask(input: unknown) {
  const parsed = updateTaskSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.milestoneId !== undefined) updates.milestone_id = parsed.milestoneId;
  if (parsed.priority !== undefined) updates.priority = parsed.priority;
  if (parsed.assigneeUserId !== undefined) updates.assignee_user_id = parsed.assigneeUserId;
  if (parsed.dueDate !== undefined) updates.due_date = parsed.dueDate;

  const { error } = await supabase
    .from("project_tasks")
    .update(updates)
    .eq("id", parsed.taskId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_tasks",
    resourceId: parsed.taskId,
    action: "project.updated",
    afterState: updates,
  });
}

/**
 * The narrow assignee-self-service exception: a task's own assignee may
 * flip its status/completed_at without holding projects.update, provided
 * they still pass has_project_access(projectId, 'projects.read') (checked
 * here) -- RLS itself permits either path (projects.update OR
 * assignee_user_id = auth.uid()), but this action is what narrows the
 * assignee path to status-only fields. Never accepts title/description/
 * assignee/milestone changes from this path.
 */
export async function updateTaskStatus(input: unknown) {
  const parsed = updateTaskStatusSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_READ);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: task, error: taskError } = await supabase
    .from("project_tasks")
    .select("assignee_user_id")
    .eq("id", parsed.taskId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();
  if (taskError) throw new Error(taskError.message);
  if (!task) throw new Error("Task not found");

  const hasGeneralUpdate = await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE)
    .then(() => true)
    .catch(() => false);
  if (!hasGeneralUpdate && task.assignee_user_id !== user.id) {
    throw new Error("Forbidden: only the assignee or a user with projects.update may change this task's status.");
  }

  const updates: Record<string, unknown> = {
    status: parsed.status,
    updated_at: new Date().toISOString(),
  };
  if (parsed.status === "done") updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("project_tasks")
    .update(updates)
    .eq("id", parsed.taskId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  const isCompleting = parsed.status === "done";
  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_tasks",
    resourceId: parsed.taskId,
    action: isCompleting ? "task.completed" : "project.updated",
    afterState: { status: parsed.status },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: isCompleting ? "task.completed" : "task.updated",
    summary: isCompleting ? "Task completed" : `Task status changed to ${parsed.status}`,
  });
}
