"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { createReadinessCheckSchema, completeReadinessCheckSchema } from "@/lib/validation/projects";

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

export async function createReadinessCheck(input: unknown) {
  const parsed = createReadinessCheckSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: check, error } = await supabase
    .from("project_readiness_checks")
    .insert({
      organisation_id: scope.organisation_id,
      company_id: scope.company_id,
      project_id: parsed.projectId,
      title: parsed.title,
      description: parsed.description ?? null,
      is_required: parsed.isRequired,
      sequence: parsed.sequence,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_readiness_checks",
    resourceId: check.id,
    action: "readiness_check.created",
    afterState: { title: parsed.title, isRequired: parsed.isRequired },
  });

  return { checkId: check.id };
}

export async function completeReadinessCheck(input: unknown) {
  const parsed = completeReadinessCheckSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_readiness_checks")
    .update({
      status: parsed.decision,
      completed_by: user.id,
      completed_at: new Date().toISOString(),
      evidence_note: parsed.evidenceNote ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.checkId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_readiness_checks",
    resourceId: parsed.checkId,
    action: "readiness_check.completed",
    afterState: { status: parsed.decision },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "readiness_check.completed",
    summary: `Readiness check marked ${parsed.decision}`,
  });
}
