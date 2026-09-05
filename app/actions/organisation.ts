"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requirePermission, hasOrgPermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import {
  grantOrganisationAccessSchema,
  revokeOrganisationAccessSchema,
} from "@/lib/validation/members";
import { createServiceRoleClient, createServerSupabaseClient } from "@/lib/database/server";

/**
 * Founder-only: grants group-wide (organisation-level) access. See
 * docs/permissions.md "Founder Access" -- this is the ONLY code path that
 * creates an organisation_members row; there is no bypass anywhere else.
 * permissions.manage is an organisation-scoped permission (not company-
 * scoped), so it is checked via hasOrgPermission, not requirePermission.
 */
export async function grantOrganisationAccess(input: unknown) {
  const parsed = grantOrganisationAccessSchema.parse(input);
  const user = await requireCurrentUser();

  const allowed = await hasOrgPermission(parsed.organisationId, PERMISSIONS.PERMISSIONS_MANAGE);
  if (!allowed) {
    throw new Error("Forbidden: missing permissions.manage at the organisation level");
  }

  // organisation_members' uniqueness constraint is a PARTIAL index (one
  // active row per org/user -- see 0005_organisation_members.sql), so a
  // plain upsert(onConflict: "organisation_id,user_id") cannot target it.
  // Resolve manually: reactivate any existing row, or insert fresh.
  const service = createServiceRoleClient();
  const { data: existing, error: existingError } = await service
    .from("organisation_members")
    .select("id")
    .eq("organisation_id", parsed.organisationId)
    .eq("user_id", parsed.userId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const { data, error } = existing
    ? await service
        .from("organisation_members")
        .update({
          role_id: parsed.roleId,
          status: "active",
          granted_by: user.id,
          granted_at: new Date().toISOString(),
          removed_at: null,
          removed_by: null,
        })
        .eq("id", existing.id)
        .select("id")
        .single()
    : await service
        .from("organisation_members")
        .insert({
          organisation_id: parsed.organisationId,
          user_id: parsed.userId,
          role_id: parsed.roleId,
          status: "active",
          granted_by: user.id,
          granted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: parsed.organisationId,
    resourceType: "organisation_members",
    resourceId: data.id,
    action: "organisation_members.granted",
    afterState: { userId: parsed.userId, roleId: parsed.roleId },
  });

  return { organisationMembershipId: data.id };
}

export async function revokeOrganisationAccess(input: unknown) {
  const parsed = revokeOrganisationAccessSchema.parse(input);
  const user = await requireCurrentUser();

  const allowed = await hasOrgPermission(parsed.organisationId, PERMISSIONS.PERMISSIONS_MANAGE);
  if (!allowed) {
    throw new Error("Forbidden: missing permissions.manage at the organisation level");
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from("organisation_members")
    .update({ status: "removed", removed_at: new Date().toISOString(), removed_by: user.id })
    .eq("id", parsed.membershipId)
    .eq("organisation_id", parsed.organisationId);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: parsed.organisationId,
    resourceType: "organisation_members",
    resourceId: parsed.membershipId,
    action: "organisation_members.revoked",
  });
}

export async function listAuditLog(companyId: string) {
  await requireCurrentUser();
  await requirePermission(companyId, PERMISSIONS.AUDIT_READ);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, actor_user_id, actor_type, action, resource_type, resource_id, result_status, created_at, user_profiles:actor_user_id(full_name, email)"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data;
}
