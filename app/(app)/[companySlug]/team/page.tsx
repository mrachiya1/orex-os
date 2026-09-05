import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { MemberTable } from "@/components/team/MemberTable";
import { InviteMemberButton } from "@/components/team/InviteMemberButton";
import { PageHeader, Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTeams } from "@/components/ui/icons";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const canRead = await hasPermission(company.id, PERMISSIONS.TEAM_READ);
  if (!canRead) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Team" />
        <div className="p-8 pt-6">
          <Card>
            <EmptyState icon={<IconTeams width={16} height={16} />} title="You don't have permission to view this company's team." />
          </Card>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: members }, { data: roles }, canInvite, canRemove] = await Promise.all([
    supabase
      .from("company_members")
      .select("id, user_id, status, joined_at, user_profiles(full_name, email), roles(label)")
      .eq("company_id", company.id)
      .order("joined_at"),
    supabase.from("roles").select("id, label").order("label"),
    hasPermission(company.id, PERMISSIONS.TEAM_INVITE),
    hasPermission(company.id, PERMISSIONS.TEAM_REMOVE),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Team"
        description="Manage company members, access and roles."
        action={
          canInvite ? <InviteMemberButton companyId={company.id} roles={roles ?? []} /> : undefined
        }
      />
      <div className="p-8 pt-6">
        <div className="mb-3 flex gap-4 text-[12.5px]">
          <span className="font-semibold text-[var(--text-primary)]">Members</span>
          <Link href={`/${companySlug}/team/roles`} className="ox-focus-ring text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            Roles &amp; Permissions
          </Link>
        </div>
        <Card>
          <CardHeader title="Members" />
          <MemberTable
            companyId={company.id}
            members={(members ?? []) as never}
            canRemove={canRemove}
          />
        </Card>
      </div>
    </div>
  );
}
