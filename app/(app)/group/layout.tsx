import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { listMyCompanies } from "@/app/actions/team";
import { getSidebarIdentity } from "@/lib/database/profile";
import { hasOrgPermission, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/database/server";
import { Sidebar } from "@/components/shell/Sidebar";

/**
 * The Founder Group Command Centre lives outside any single company's URL
 * segment, so it needs its own shell wrapper. The sidebar still needs *a*
 * company slug to build its per-company nav links -- it uses the first
 * company the user can see, purely for navigation, never for scoping the
 * group page's own data (that's organisation_id, checked independently
 * below and again by RLS on every query the page makes).
 */
export default async function GroupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data: organisation } = await supabase.from("organisations").select("id").limit(1).maybeSingle();
  if (!organisation) redirect("/");

  const allowed = await hasOrgPermission(organisation.id, PERMISSIONS.PROJECTS_READ);
  if (!allowed) redirect("/");

  const companies = await listMyCompanies();
  const primarySlug = companies?.[0]?.slug;
  if (!primarySlug) redirect("/");

  const { data: company } = await supabase
    .from("companies")
    .select("id, organisation_id")
    .eq("slug", primarySlug)
    .maybeSingle();

  const [identity, canViewTeam] = await Promise.all([
    company ? getSidebarIdentity(user, company.id, company.organisation_id) : Promise.resolve({ displayName: null, roleLabel: null }),
    company ? hasPermission(company.id, PERMISSIONS.TEAM_READ) : Promise.resolve(false),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        companies={companies ?? []}
        activeSlug={primarySlug}
        displayName={identity.displayName}
        roleLabel={identity.roleLabel}
        email={user.email}
        hasGroupAccess
        canViewTeam={canViewTeam}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
