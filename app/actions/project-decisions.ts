"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, requireScopedPermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { linkDecisionToProjectSchema, unlinkDecisionFromProjectSchema } from "@/lib/validation/projects";

/**
 * Links/unlinks an existing Phase 003 decision to a project by setting/
 * clearing decisions.project_id -- never a join table (founder decision
 * #9). Requires the caller to independently hold access to BOTH the
 * project (has_project_access) and the decision at its own company/
 * organisation scope (the unmodified Phase 003 decisions.update check) --
 * project access alone never grants decision access, and vice versa.
 * Cross-company link attempts are rejected here at the application layer,
 * since the FK itself doesn't know about company boundaries.
 */
export async function linkDecisionToProject(input: unknown) {
  const parsed = linkDecisionToProjectSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const [{ data: project, error: projectError }, { data: decision, error: decisionError }] = await Promise.all([
    supabase.from("projects").select("organisation_id, company_id").eq("id", parsed.projectId).maybeSingle(),
    supabase
      .from("decisions")
      .select("id, organisation_id, company_id")
      .eq("id", parsed.decisionId)
      .maybeSingle(),
  ]);
  if (projectError) throw new Error(projectError.message);
  if (decisionError) throw new Error(decisionError.message);
  if (!project) throw new Error("Project not found");
  if (!decision) throw new Error("Decision not found");

  await requireScopedPermission(decision.company_id, decision.organisation_id, PERMISSIONS.DECISIONS_UPDATE);

  if (decision.organisation_id !== project.organisation_id || decision.company_id !== project.company_id) {
    throw new Error("Cannot link a decision to a project outside its own company/organisation scope.");
  }

  const { error } = await supabase
    .from("decisions")
    .update({ project_id: parsed.projectId, updated_at: new Date().toISOString() })
    .eq("id", parsed.decisionId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: project.organisation_id,
    companyId: project.company_id,
    resourceType: "decisions",
    resourceId: parsed.decisionId,
    action: "decision.updated",
    afterState: { projectId: parsed.projectId },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "decision.linked",
    summary: "Decision linked to project",
  });
}

export async function unlinkDecisionFromProject(input: unknown) {
  const parsed = unlinkDecisionFromProjectSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .select("id, organisation_id, company_id, project_id")
    .eq("id", parsed.decisionId)
    .maybeSingle();
  if (decisionError) throw new Error(decisionError.message);
  if (!decision) throw new Error("Decision not found");
  if (decision.project_id !== parsed.projectId) throw new Error("Decision is not linked to this project");

  await requireScopedPermission(decision.company_id, decision.organisation_id, PERMISSIONS.DECISIONS_UPDATE);

  const { error } = await supabase
    .from("decisions")
    .update({ project_id: null, updated_at: new Date().toISOString() })
    .eq("id", parsed.decisionId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: decision.organisation_id,
    companyId: decision.company_id,
    resourceType: "decisions",
    resourceId: parsed.decisionId,
    action: "decision.updated",
    afterState: { projectId: null },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "decision.unlinked",
    summary: "Decision unlinked from project",
  });
}
