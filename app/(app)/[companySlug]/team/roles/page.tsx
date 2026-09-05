import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listAllPermissions, getRolePermissionKeys } from "@/lib/database/permissions-catalog";
import { PageHeader, Card, CardHeader } from "@/components/ui/Surface";
import { PermissionsMatrix } from "@/components/people/PermissionsMatrix";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Read-only. Editing role_permissions is a materially riskier feature
 * (misconfiguring a role affects every member holding it, company-wide)
 * that wasn't part of this pass's approved scope -- see prompts/010
 * "Deferred Items". This view exists for transparency, per AGENTS.md
 * Phase 001's original "minimal read-only permission-matrix view" note.
 */
export default async function RolesPermissionsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const canManage = await hasPermission(company.id, PERMISSIONS.PERMISSIONS_MANAGE);
  if (!canManage) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Roles & Permissions" />
        <div className="p-8 pt-6">
          <Card>
            <EmptyState title="You don't have permission to view this." />
          </Card>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: roles }, allPermissions] = await Promise.all([
    supabase.from("roles").select("id, label, key, is_resource_scoped").order("label"),
    listAllPermissions(),
  ]);

  const rolesWithGrants = await Promise.all(
    (roles ?? []).map(async (role) => ({
      role,
      granted: await getRolePermissionKeys(role.id),
    }))
  );

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Roles & Permissions" description="What each role can do across Orex OS. Read-only for now." />
      <div className="grid grid-cols-1 gap-3.5 p-8 pt-6 lg:grid-cols-2">
        {rolesWithGrants.map(({ role, granted }) => (
          <Card key={role.id}>
            <CardHeader
              title={role.label}
              action={role.is_resource_scoped ? <span className="ox-pill ox-pill-info">Project-scoped</span> : undefined}
            />
            <div className="px-5 pb-5">
              <PermissionsMatrix permissions={allPermissions} granted={granted} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
