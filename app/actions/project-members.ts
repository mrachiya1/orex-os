"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { addProjectMemberSchema, removeProjectMemberSchema } from "@/lib/validation/projects";

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
 * Gated by projects.assign, which Contractor does not hold in the existing
 * Phase 001 role matrix -- a Contractor cannot grant themselves (or anyone
 * else) project membership, with zero new logic beyond reusing the
 * existing permission catalog.
 */
export async function addProjectMember(input: unknown) {
  const parsed = addProjectMemberSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_ASSIGN);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", parsed.projectId)
    .eq("user_id", parsed.userId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const writeError = existing
    ? (
        await supabase
          .from("project_members")
          .update({
            project_role: parsed.projectRole,
            status: "active",
            added_by: user.id,
            added_at: new Date().toISOString(),
            removed_at: null,
            removed_by: null,
          })
          .eq("id", existing.id)
      ).error
    : (
        await supabase.from("project_members").insert({
          project_id: parsed.projectId,
          user_id: parsed.userId,
          project_role: parsed.projectRole,
          added_by: user.id,
        })
      ).error;
  if (writeError) throw new Error(writeError.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_members",
    resourceId: parsed.projectId,
    action: "project_member.added",
    afterState: { userId: parsed.userId, projectRole: parsed.projectRole },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "member.added",
    summary: `Member added as ${parsed.projectRole}`,
  });
}

export async function removeProjectMember(input: unknown) {
  const parsed = removeProjectMemberSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_ASSIGN);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_members")
    .update({ status: "removed", removed_at: new Date().toISOString(), removed_by: user.id })
    .eq("id", parsed.membershipId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_members",
    resourceId: parsed.membershipId,
    action: "project_member.removed",
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "member.removed",
    summary: "Member removed",
  });
}
