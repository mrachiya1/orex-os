"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/database/server";
import { listAllPermissions, getRolePermissionKeys } from "@/lib/database/permissions-catalog";
import { updateWorkProfileSchema, updatePrivateProfileSchema } from "@/lib/validation/people";

/** Client-callable wrappers for the invite/edit-permissions UI to seed its
 * checkbox list from a role's real defaults -- read-only, no permission
 * gate beyond being signed in (the catalog itself is public-readable). */
export async function listAllPermissionsAction() {
  await requireCurrentUser();
  return listAllPermissions();
}

export async function getRolePermissionKeysAction(roleId: string) {
  await requireCurrentUser();
  return Array.from(await getRolePermissionKeys(roleId));
}

/** The current user's own effective permission keys for a company -- used
 * client-side only to grey out checkboxes they couldn't grant anyway; the
 * real enforcement is areOverridesAssignable() in the server action. */
export async function listMyEffectivePermissionKeysAction(companyId: string) {
  await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("my_effective_permissions", { target_company_id: companyId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { key: string } | string) => (typeof r === "string" ? r : r.key));
}

/**
 * Work profile fields live on user_profiles -- broadly readable by anyone
 * who can already see the person in a shared company (same visibility as
 * today's full_name/email), never gated behind a separate permission. Only
 * the person themself can edit it here -- an admin-edits-others'-profile
 * flow was not requested and would need its own permission design, so it's
 * deliberately not built (see prompts/010 "Deferred Items").
 */
export async function updateWorkProfile(input: unknown) {
  const parsed = updateWorkProfileSchema.parse(input);
  const user = await requireCurrentUser();
  if (parsed.userId !== user.id) {
    throw new Error("Forbidden: you can only edit your own work profile.");
  }

  const supabase = await createServerSupabaseClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.displayName !== undefined) updates.display_name = parsed.displayName;
  if (parsed.jobTitle !== undefined) updates.job_title = parsed.jobTitle;
  if (parsed.department !== undefined) updates.department = parsed.department;
  if (parsed.timezone !== undefined) updates.timezone = parsed.timezone;
  if (parsed.skills !== undefined) updates.skills = parsed.skills;

  const { error } = await supabase.from("user_profiles").update(updates).eq("id", user.id);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    resourceType: "user_profiles",
    resourceId: user.id,
    action: "profile.work_updated",
    afterState: updates,
  });
}

/**
 * Private profile: self-only, enforced here AND by RLS (defense in depth --
 * neither layer alone is trusted). No Founder/admin bypass exists anywhere
 * in this file, on purpose (AGENTS.md "Founder Access Principle").
 */
export async function getMyPrivateProfile() {
  const user = await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_private_profiles")
    .select("personal_email, personal_phone, birthday, address, private_notes")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMyPrivateProfile(input: unknown) {
  const parsed = updatePrivateProfileSchema.parse(input);
  const user = await requireCurrentUser();

  const supabase = await createServerSupabaseClient();
  const updates: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  if (parsed.personalEmail !== undefined) updates.personal_email = parsed.personalEmail;
  if (parsed.personalPhone !== undefined) updates.personal_phone = parsed.personalPhone;
  if (parsed.birthday !== undefined) updates.birthday = parsed.birthday;
  if (parsed.address !== undefined) updates.address = parsed.address;
  if (parsed.privateNotes !== undefined) updates.private_notes = parsed.privateNotes;

  const { error } = await supabase.from("user_private_profiles").upsert(updates, { onConflict: "user_id" });
  if (error) throw new Error(error.message);

  // Deliberately NOT audited with field contents (AGENTS.md "private
  // profile reads should NOT become a noisy general audit stream" and
  // "Do not log private profile contents"). A bare structural event only.
  await writeAuditLog({
    actorUserId: user.id,
    resourceType: "user_private_profiles",
    resourceId: user.id,
    action: "private_profile.updated",
  });
}

/**
 * Cross-company membership list for one person -- reveals which companies
 * someone belongs to, so it requires organisation-level team.read, not
 * plain company access (an Orextic-only admin should not learn someone's
 * Orex Studios membership just because they share Orextic).
 */
export async function getCompanyMembershipsForUser(userId: string, organisationId: string) {
  await requireCurrentUser();
  const allowed = await hasOrgPermission(organisationId, PERMISSIONS.TEAM_READ);
  if (!allowed) throw new Error("Forbidden");

  const supabase = await createServerSupabaseClient();
  const [{ data: companyRows }, { data: orgRows }] = await Promise.all([
    supabase
      .from("company_members")
      .select("id, status, joined_at, company_id, companies(name, slug, organisation_id), roles(label)")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("organisation_members")
      .select("id, status, granted_at, organisation_id, roles(label)")
      .eq("user_id", userId)
      .eq("organisation_id", organisationId)
      .eq("status", "active"),
  ]);

  const companyMemberships = (companyRows ?? []).filter((r) => {
    const company = Array.isArray(r.companies) ? r.companies[0] : r.companies;
    return company?.organisation_id === organisationId;
  });

  return { companyMemberships, orgMemberships: orgRows ?? [] };
}
