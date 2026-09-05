import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { requireCurrentUser } from "@/lib/auth/session";
import { listMyCompanies } from "@/app/actions/team";
import { getSidebarIdentity } from "@/lib/database/profile";
import { hasOrgPermission, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Sidebar } from "@/components/shell/Sidebar";

/**
 * Resolves the active company from the URL slug and renders the permanent
 * Orex OS app shell (sidebar + scrollable main content) around it. The
 * company lookup below is still RLS-filtered -- a user who is not a member
 * of this company (and has no organisation-level grant) gets zero rows back
 * regardless of what slug they type, which is what turns a forged/guessed
 * slug into a 404 rather than a data leak (docs/security.md "Multi-Company
 * Isolation"). The sidebar's company list and role label are read-only
 * presentation, not an authorization layer -- every page under this layout
 * still enforces its own hasPermission/RLS checks independently.
 */
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const user = await requireCurrentUser();
  const [companies, identity, hasGroupAccess, canViewTeam] = await Promise.all([
    listMyCompanies(),
    getSidebarIdentity(user, company.id, company.organisation_id),
    hasOrgPermission(company.organisation_id, PERMISSIONS.PROJECTS_READ),
    hasPermission(company.id, PERMISSIONS.TEAM_READ),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        companies={companies ?? []}
        activeSlug={companySlug}
        displayName={identity.displayName}
        roleLabel={identity.roleLabel}
        email={user.email}
        hasGroupAccess={hasGroupAccess}
        canViewTeam={canViewTeam}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
