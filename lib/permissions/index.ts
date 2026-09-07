import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/database/server";
import type { PermissionKey } from "./catalog";

export { PERMISSIONS } from "./catalog";
export type { PermissionKey } from "./catalog";

/**
 * The single sanctioned server-side authorization check (see
 * docs/permissions.md "Server-Side Permission Checks"). Mirrors the RLS
 * helper functions has_company_permission / has_org_permission exactly:
 * an active company_members row for this company, OR an active
 * organisation_members row covering this company's organisation, whose role
 * grants the permission.
 *
 * This calls the same SQL function RLS uses (via RPC) rather than
 * re-implementing the join in TypeScript, so the two layers cannot drift.
 *
 * React.cache() so repeated identical checks (same companyId + permissionKey,
 * same authenticated session) within one request dedupe to a single RPC call.
 * Different arguments always independently hit the database -- no check is
 * ever skipped, weakened, or shared across users/requests.
 */
export const hasPermission = cache(async (
  companyId: string,
  permissionKey: PermissionKey
): Promise<boolean> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("has_company_permission", {
    target_company_id: companyId,
    permission_key: permissionKey,
  });

  if (error) {
    throw new Error(`Permission check failed: ${error.message}`);
  }

  return Boolean(data);
});

export const hasOrgPermission = cache(async (
  organisationId: string,
  permissionKey: PermissionKey
): Promise<boolean> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("has_org_permission", {
    target_organisation_id: organisationId,
    permission_key: permissionKey,
  });

  if (error) {
    throw new Error(`Permission check failed: ${error.message}`);
  }

  return Boolean(data);
});

/**
 * Phase 004 project-level check. Mirrors has_project_access() exactly (see
 * supabase/migrations/0019_projects_and_delivery.sql) -- an active
 * company_members row for this project's company (further narrowed by an
 * active project_members row for any role with roles.is_resource_scoped =
 * true), OR an active organisation_members row covering the project's
 * organisation. Project membership can only narrow access relative to
 * hasPermission, never widen it.
 */
export const hasProjectAccess = cache(async (
  projectId: string,
  permissionKey: PermissionKey
): Promise<boolean> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("has_project_access", {
    target_project_id: projectId,
    permission_key: permissionKey,
  });

  if (error) {
    throw new Error(`Permission check failed: ${error.message}`);
  }

  return Boolean(data);
});

export async function requireProjectAccess(
  projectId: string,
  permissionKey: PermissionKey
): Promise<void> {
  const allowed = await hasProjectAccess(projectId, permissionKey);
  if (!allowed) {
    throw new Error("Forbidden: missing required permission");
  }
}

/**
 * Throws if the current user lacks the given permission on the company.
 * Use at the top of every protected server action/route handler.
 */
export async function requirePermission(
  companyId: string,
  permissionKey: PermissionKey
): Promise<void> {
  const allowed = await hasPermission(companyId, permissionKey);
  if (!allowed) {
    throw new Error("Forbidden: missing required permission");
  }
}

/**
 * Throws if the current user lacks the given permission at the
 * organisation (group) level. Used for company_id = null (Orex Group)
 * scoped records -- e.g. Phase 003 group-level knowledge_items/decisions --
 * where a company-level permission alone must never be sufficient.
 */
export async function requireOrgPermission(
  organisationId: string,
  permissionKey: PermissionKey
): Promise<void> {
  const allowed = await hasOrgPermission(organisationId, permissionKey);
  if (!allowed) {
    throw new Error("Forbidden: missing required permission");
  }
}

/**
 * Resolves a knowledge/decision-style permission at the correct scope: a
 * non-null companyId checks the company-level grant; a null companyId
 * (group-level record) checks the organisation-level grant. Never mixes the
 * two -- a company permission never authorizes a group-level row and vice
 * versa (prompts/003-company-brain.md section 18 "Company/Group Scoping").
 */
export async function requireScopedPermission(
  companyId: string | null,
  organisationId: string,
  permissionKey: PermissionKey
): Promise<void> {
  if (companyId) {
    await requirePermission(companyId, permissionKey);
  } else {
    await requireOrgPermission(organisationId, permissionKey);
  }
}
