import "server-only";
import { createServerSupabaseClient } from "@/lib/database/server";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * Read-only display data for the sidebar footer (name + role label). This
 * is presentation only — it never gates access. Real authorization stays
 * with hasPermission/hasOrgPermission and RLS, which this deliberately does
 * not duplicate or short-circuit.
 */
export async function getSidebarIdentity(
  user: CurrentUser,
  companyId: string,
  organisationId: string
): Promise<{ displayName: string | null; roleLabel: string | null }> {
  const supabase = await createServerSupabaseClient();

  const [{ data: profile }, { data: companyRole }] = await Promise.all([
    supabase.from("user_profiles").select("full_name, display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("company_members")
      .select("roles(label)")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  let roleLabel: string | null = extractRoleLabel(companyRole);

  if (!roleLabel) {
    const { data: orgRole } = await supabase
      .from("organisation_members")
      .select("roles(label)")
      .eq("organisation_id", organisationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    roleLabel = extractRoleLabel(orgRole);
  }

  return {
    displayName: profile?.display_name ?? profile?.full_name ?? null,
    roleLabel,
  };
}

function extractRoleLabel(row: { roles: { label: string } | { label: string }[] | null } | null): string | null {
  if (!row) return null;
  const roles = row.roles;
  if (Array.isArray(roles)) return roles[0]?.label ?? null;
  return roles?.label ?? null;
}
