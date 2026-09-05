"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { createScopeChangeSchema, approveScopeChangeSchema } from "@/lib/validation/projects";

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

/** Never touches finance/pricing -- impact_summary is free text for a human to describe. */
export async function createScopeChange(input: unknown) {
  const parsed = createScopeChangeSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.SCOPE_CHANGES_CREATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: scopeChange, error } = await supabase
    .from("project_scope_changes")
    .insert({
      project_id: parsed.projectId,
      summary: parsed.summary,
      reason: parsed.reason ?? null,
      impact_summary: parsed.impactSummary ?? null,
      requested_by: user.id,
      is_blocking: parsed.isBlocking,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_scope_changes",
    resourceId: scopeChange.id,
    action: "scope_change.created",
    afterState: { summary: parsed.summary, isBlocking: parsed.isBlocking },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "scope_change.recorded",
    summary: `Scope change recorded: ${parsed.summary}`,
  });

  return { scopeChangeId: scopeChange.id };
}

export async function approveScopeChange(input: unknown) {
  const parsed = approveScopeChangeSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.SCOPE_CHANGES_APPROVE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_scope_changes")
    .update({
      approval_state: parsed.decision,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", parsed.scopeChangeId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_scope_changes",
    resourceId: parsed.scopeChangeId,
    action: "scope_change.approved",
    afterState: { approvalState: parsed.decision },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "scope_change.approved",
    summary: `Scope change ${parsed.decision}`,
  });
}
