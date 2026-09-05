"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requirePermission, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isRoleAssignable, areOverridesAssignable } from "@/lib/permissions/role-cap";
import { writeAuditLog } from "@/lib/audit";
import { generateInvitationToken, hashInvitationToken } from "@/lib/auth/invitation-token";
import { sendInvitationEmail } from "@/lib/integrations/email";
import {
  createInvitationSchema,
  acceptInvitationSchema,
  revokeInvitationSchema,
} from "@/lib/validation/invitations";
import { removeMemberSchema, updateMemberRoleSchema, updateMemberPermissionOverridesSchema } from "@/lib/validation/members";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/database/server";
import type { ActionResult } from "@/lib/actions/result";

const INVITATION_EXPIRY_DAYS = 7;

export async function inviteMember(input: unknown) {
  const parsed = createInvitationSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.TEAM_INVITE);

  const supabase = await createServerSupabaseClient();

  const { data: inviterPerms, error: permsError } = await supabase.rpc(
    "my_effective_permissions",
    { target_company_id: parsed.companyId }
  );
  if (permsError) throw new Error(permsError.message);
  const inviterPermissionKeys = (inviterPerms ?? []).map((r: { key: string } | string) =>
    typeof r === "string" ? r : r.key
  );

  const { data: targetRolePerms, error: rolePermsError } = await supabase
    .from("role_permissions")
    .select("permissions(key)")
    .eq("role_id", parsed.roleId);
  if (rolePermsError) throw new Error(rolePermsError.message);
  const targetPermissionKeys = (targetRolePerms ?? []).map(
    (r: { permissions: { key: string } | { key: string }[] | null }) => {
      const p = r.permissions;
      return Array.isArray(p) ? p[0]?.key : p?.key;
    }
  ).filter(Boolean) as string[];

  if (!isRoleAssignable(inviterPermissionKeys, targetPermissionKeys)) {
    throw new Error("Forbidden: cannot assign a role above your own permission set");
  }

  if (parsed.permissionOverrides && !areOverridesAssignable(inviterPermissionKeys, parsed.permissionOverrides)) {
    throw new Error("Forbidden: cannot grant a custom permission above your own permission set");
  }
  if (parsed.permissionOverrides) {
    const { data: validKeys } = await supabase.from("permissions").select("key");
    const known = new Set((validKeys ?? []).map((p) => p.key));
    for (const key of Object.keys(parsed.permissionOverrides)) {
      if (!known.has(key)) throw new Error(`Unknown permission key: ${key}`);
    }
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      company_id: parsed.companyId,
      role_id: parsed.roleId,
      email: parsed.email,
      token_hash: tokenHash,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
      permission_overrides: parsed.permissionOverrides ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", parsed.companyId)
    .single();
  const { data: role } = await supabase
    .from("roles")
    .select("label")
    .eq("id", parsed.roleId)
    .single();

  const inviteUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/accept-invite/${token}`;

  const emailResult = await sendInvitationEmail({
    to: parsed.email,
    companyName: company?.name ?? "Orex OS",
    roleLabel: role?.label ?? "Member",
    inviteUrl,
  });

  await writeAuditLog({
    actorUserId: user.id,
    companyId: parsed.companyId,
    resourceType: "invitations",
    resourceId: invitation.id,
    action: "invitation.created",
    afterState: { email: parsed.email, roleId: parsed.roleId, expiresAt },
  });

  return { invitationId: invitation.id, inviteUrl, emailSent: emailResult.sent };
}

export type InvitationPreview =
  | { status: "invalid" }
  | { status: "revoked" }
  | { status: "expired" }
  | { status: "already_accepted"; companySlug: string | null }
  | {
      status: "valid";
      email: string;
      companyName: string;
      roleLabel: string;
      invitedByName: string;
    };

/**
 * Pre-authentication preview: deliberately does NOT call requireCurrentUser
 * -- the whole point is to show the invitation screen (company, role,
 * inviter) *before* asking someone to sign in or create an account. Uses
 * the service-role client because invitations has no anonymous-readable
 * policy (same reason acceptInvitation() below does), and returns only the
 * handful of fields safe to show someone holding a valid token -- never
 * the token hash, never other people's data, never a raw database error.
 */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const tokenHash = hashInvitationToken(token);
  const service = createServiceRoleClient();

  const { data: invitation } = await service
    .from("invitations")
    .select("status, expires_at, email, invited_by, companies(name, slug), roles(label)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invitation) return { status: "invalid" };
  if (invitation.status === "revoked") return { status: "revoked" };
  if (invitation.status === "expired") return { status: "expired" };
  if (invitation.status === "accepted") {
    const company = Array.isArray(invitation.companies) ? invitation.companies[0] : invitation.companies;
    return { status: "already_accepted", companySlug: company?.slug ?? null };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await service.from("invitations").update({ status: "expired" }).eq("token_hash", tokenHash);
    return { status: "expired" };
  }

  const company = Array.isArray(invitation.companies) ? invitation.companies[0] : invitation.companies;
  const role = Array.isArray(invitation.roles) ? invitation.roles[0] : invitation.roles;
  const { data: inviter } = invitation.invited_by
    ? await service.from("user_profiles").select("full_name, email").eq("id", invitation.invited_by).maybeSingle()
    : { data: null };

  return {
    status: "valid",
    email: invitation.email,
    companyName: company?.name ?? "Orex OS",
    roleLabel: role?.label ?? "Member",
    invitedByName: inviter?.full_name ?? inviter?.email ?? "A founder",
  };
}

/**
 * Returns ActionResult rather than throwing -- this is called directly from
 * the accept-invite Client Component, and Next.js redacts thrown-error
 * messages from Server Actions in production builds (see
 * lib/actions/result.ts), which would otherwise turn every one of these
 * specific, user-facing messages into an unhelpful generic digest.
 */
export async function acceptInvitation(
  input: unknown
): Promise<ActionResult<{ companyId: string; companySlug: string | null }>> {
  const { token } = acceptInvitationSchema.parse(input);
  const user = await requireCurrentUser();
  const tokenHash = hashInvitationToken(token);

  const service = createServiceRoleClient();

  const { data: invitation, error } = await service
    .from("invitations")
    .select("id, company_id, role_id, status, expires_at, email, permission_overrides, companies(slug)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) return { ok: false, error: "Something went wrong. Please try again." };
  if (!invitation) return { ok: false, error: "Invalid invitation" };

  if (invitation.status !== "pending") {
    return { ok: false, error: "This invitation has already been used or revoked" };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await service.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
    return { ok: false, error: "This invitation has expired" };
  }
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return {
      ok: false,
      error: "This invitation was sent to a different email address. Sign in with that email to accept it.",
    };
  }

  // company_members' uniqueness constraint is a PARTIAL index (one active
  // row per company/user -- see 0006_company_members_and_rls_helpers.sql),
  // so a plain upsert(onConflict: "company_id,user_id") cannot target it
  // (Postgres requires an exact predicate match for partial-index conflict
  // inference). Resolve manually instead: reactivate any existing row
  // (active or previously removed) for this company/user, or insert fresh.
  const { data: existingMembership, error: existingError } = await service
    .from("company_members")
    .select("id")
    .eq("company_id", invitation.company_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) return { ok: false, error: "Something went wrong. Please try again." };

  const permissionOverrides = invitation.permission_overrides ?? {};
  const membershipError = existingMembership
    ? (
        await service
          .from("company_members")
          .update({
            role_id: invitation.role_id,
            status: "active",
            joined_at: new Date().toISOString(),
            removed_at: null,
            removed_by: null,
            permission_overrides: permissionOverrides,
          })
          .eq("id", existingMembership.id)
      ).error
    : (
        await service.from("company_members").insert({
          company_id: invitation.company_id,
          user_id: user.id,
          role_id: invitation.role_id,
          status: "active",
          invited_by: null,
          joined_at: new Date().toISOString(),
          permission_overrides: permissionOverrides,
        })
      ).error;
  if (membershipError) return { ok: false, error: "Something went wrong. Please try again." };

  await service
    .from("invitations")
    .update({ status: "accepted", accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  await writeAuditLog({
    actorUserId: user.id,
    companyId: invitation.company_id,
    resourceType: "invitations",
    resourceId: invitation.id,
    action: "invitation.accepted",
    afterState: { roleId: invitation.role_id },
  });
  await writeAuditLog({
    actorUserId: user.id,
    companyId: invitation.company_id,
    resourceType: "company_members",
    action: "company_members.joined",
    afterState: { roleId: invitation.role_id },
  });

  const companySlug = Array.isArray(invitation.companies)
    ? invitation.companies[0]?.slug
    : (invitation.companies as { slug: string } | null)?.slug;

  return { ok: true, companyId: invitation.company_id, companySlug: companySlug ?? null };
}

export async function revokeInvitation(input: unknown) {
  const parsed = revokeInvitationSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.TEAM_INVITE);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", parsed.invitationId)
    .eq("company_id", parsed.companyId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    companyId: parsed.companyId,
    resourceType: "invitations",
    resourceId: parsed.invitationId,
    action: "invitation.revoked",
  });
}

export async function removeMember(input: unknown) {
  const parsed = removeMemberSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.TEAM_REMOVE);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("company_members")
    .update({ status: "removed", removed_at: new Date().toISOString(), removed_by: user.id })
    .eq("id", parsed.membershipId)
    .eq("company_id", parsed.companyId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    companyId: parsed.companyId,
    resourceType: "company_members",
    resourceId: parsed.membershipId,
    action: "company_members.removed",
    reason: parsed.reason ?? null,
    afterState: { status: "removed" },
  });
}

export async function updateMemberRole(input: unknown) {
  const parsed = updateMemberRoleSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.TEAM_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("company_members")
    .update({ role_id: parsed.roleId })
    .eq("id", parsed.membershipId)
    .eq("company_id", parsed.companyId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    companyId: parsed.companyId,
    resourceType: "company_members",
    resourceId: parsed.membershipId,
    action: "company_members.role_changed",
    afterState: { roleId: parsed.roleId },
  });
}

/**
 * Edits an existing member's per-permission overrides directly (the
 * "Optional: control permissions manually" affordance on the Roles &
 * Permissions / Member Profile UI). Requires permissions.manage -- a
 * materially higher bar than plain team.invite/team.update, since this can
 * grant capabilities beyond the member's role. Replaces the whole overrides
 * map (not a merge) so the UI's checkbox state is always the source of
 * truth for what gets persisted, matching what the actor can see on screen.
 */
export async function updateMemberPermissionOverrides(input: unknown) {
  const parsed = updateMemberPermissionOverridesSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.PERMISSIONS_MANAGE);

  const supabase = await createServerSupabaseClient();

  const { data: actorPerms, error: permsError } = await supabase.rpc("my_effective_permissions", {
    target_company_id: parsed.companyId,
  });
  if (permsError) throw new Error(permsError.message);
  const actorPermissionKeys = (actorPerms ?? []).map((r: { key: string } | string) => (typeof r === "string" ? r : r.key));

  if (!areOverridesAssignable(actorPermissionKeys, parsed.permissionOverrides)) {
    throw new Error("Forbidden: cannot grant a custom permission above your own permission set");
  }

  const { data: validKeys } = await supabase.from("permissions").select("key");
  const known = new Set((validKeys ?? []).map((p) => p.key));
  for (const key of Object.keys(parsed.permissionOverrides)) {
    if (!known.has(key)) throw new Error(`Unknown permission key: ${key}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("company_members")
    .select("permission_overrides")
    .eq("id", parsed.membershipId)
    .eq("company_id", parsed.companyId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Member not found");

  const { error } = await supabase
    .from("company_members")
    .update({ permission_overrides: parsed.permissionOverrides })
    .eq("id", parsed.membershipId)
    .eq("company_id", parsed.companyId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    companyId: parsed.companyId,
    resourceType: "company_members",
    resourceId: parsed.membershipId,
    action: "company_members.permissions_overridden",
    beforeState: { permissionOverrides: existing.permission_overrides },
    afterState: { permissionOverrides: parsed.permissionOverrides },
  });
}

export async function listMyCompanies() {
  await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, accent_color_key")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function currentUserCan(companyId: string, permissionKey: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) {
  await requireCurrentUser();
  return hasPermission(companyId, permissionKey);
}
