import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission, hasOrgPermission, PERMISSIONS } from "@/lib/permissions";
import { listAllPermissions, getRolePermissionKeys } from "@/lib/database/permissions-catalog";
import { getCompanyMembershipsForUser, getMyPrivateProfile } from "@/app/actions/people";
import { PageHeader } from "@/components/ui/Surface";
import { Avatar } from "@/components/ui/Avatar";
import { WorkProfileCard } from "@/components/people/WorkProfileCard";
import { PrivateProfileCard } from "@/components/people/PrivateProfileCard";
import { ConnectionsCard } from "@/components/people/ConnectionsCard";
import { CompanyAccessCard } from "@/components/people/CompanyAccessCard";
import { MemberPermissionsCard } from "@/components/people/MemberPermissionsCard";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ companySlug: string; userId: string }>;
}) {
  const { companySlug, userId } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const currentUser = await requireCurrentUser();
  const isSelf = currentUser.id === userId;

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, full_name, display_name, email, job_title, department, timezone, skills, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) notFound();

  const [canManageTeam, canReadAudit, canManagePermissions] = await Promise.all([
    hasPermission(company.id, PERMISSIONS.TEAM_INVITE),
    hasPermission(company.id, PERMISSIONS.AUDIT_READ),
    hasPermission(company.id, PERMISSIONS.PERMISSIONS_MANAGE),
  ]);
  void canReadAudit;

  const { data: membershipHere } = await supabase
    .from("company_members")
    .select("id, role_id, status, permission_overrides, roles(label)")
    .eq("company_id", company.id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  interface RawMembership {
    id: string;
    status: string;
    company_id: string;
    companies: { name: string; slug: string } | { name: string; slug: string }[] | null;
    roles: { label: string } | { label: string }[] | null;
  }

  const canSeeAllMemberships = await hasOrgPermission(company.organisation_id, PERMISSIONS.TEAM_READ);
  let companyMemberships: RawMembership[] = [];
  let orgMemberships: Array<{ roles: { label: string } | { label: string }[] | null }> = [];
  if (canSeeAllMemberships) {
    const result = await getCompanyMembershipsForUser(userId, company.organisation_id);
    companyMemberships = result.companyMemberships as unknown as RawMembership[];
    orgMemberships = result.orgMemberships as unknown as Array<{ roles: { label: string } | { label: string }[] | null }>;
  } else if (membershipHere) {
    companyMemberships = [
      {
        id: userId,
        status: membershipHere.status,
        company_id: company.id,
        companies: { name: company.name, slug: companySlug },
        roles: membershipHere.roles,
      },
    ];
  }

  const allCompanies = canManageTeam
    ? (await supabase.from("companies").select("id, name").eq("organisation_id", company.organisation_id)).data ?? []
    : [];
  const alreadyGrantedIds = new Set(companyMemberships.map((m) => m.company_id));
  const availableCompanies = allCompanies.filter((c) => !alreadyGrantedIds.has(c.id));

  const roles = canManageTeam ? (await supabase.from("roles").select("id, label").order("label")).data ?? [] : [];

  const [allPermissions, grantedKeys] = membershipHere?.role_id
    ? await Promise.all([listAllPermissions(), getRolePermissionKeys(membershipHere.role_id)])
    : [[], new Set<string>()];

  const privateProfile = isSelf ? await getMyPrivateProfile() : null;

  const displayName = profile.display_name ?? profile.full_name ?? profile.email ?? "Unknown";
  const firstOrgMembership = orgMemberships[0];
  const orgRoleLabel = firstOrgMembership
    ? (Array.isArray(firstOrgMembership.roles) ? firstOrgMembership.roles[0]?.label : firstOrgMembership.roles?.label) ?? null
    : null;

  const membershipRows = companyMemberships.map((row) => {
    const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    const r = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return {
      id: row.id,
      companyName: c?.name ?? "Company",
      companySlug: c?.slug ?? "",
      roleLabel: r?.label ?? "—",
      status: row.status,
    };
  });

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={displayName}
        description={profile.job_title ? `${profile.job_title}${profile.department ? ` · ${profile.department}` : ""}` : profile.email ?? undefined}
        action={<Avatar name={profile.display_name ?? profile.full_name} fallback={profile.email} size={40} />}
      />
      <div className="grid grid-cols-1 gap-3.5 p-8 pt-6 lg:grid-cols-2">
        <WorkProfileCard
          profile={{
            userId: profile.id,
            displayName: profile.display_name,
            fullName: profile.full_name,
            email: profile.email,
            jobTitle: profile.job_title,
            department: profile.department,
            timezone: profile.timezone,
            skills: profile.skills ?? [],
          }}
          isSelf={isSelf}
        />

        <CompanyAccessCard
          memberships={membershipRows}
          orgRoleLabel={orgRoleLabel}
          memberEmail={profile.email ?? ""}
          availableCompanies={availableCompanies}
          roles={roles}
          canManage={canManageTeam}
        />

        {membershipHere && (
          <MemberPermissionsCard
            companyId={company.id}
            membershipId={membershipHere.id}
            allPermissions={allPermissions}
            roleDefaults={grantedKeys}
            savedOverrides={(membershipHere.permission_overrides as Record<string, boolean>) ?? {}}
            canManage={canManagePermissions}
          />
        )}

        {isSelf && <PrivateProfileCard initial={privateProfile} />}
        {isSelf && <ConnectionsCard />}
      </div>
    </div>
  );
}
