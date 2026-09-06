import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listSessions } from "@/app/actions/sessions";
import { PageHeader, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { SessionTable } from "@/components/intelligence/SessionTable";
import { IconSessions } from "@/components/ui/icons";

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const canUse = await hasPermission(company.id, PERMISSIONS.AGENTS_USE);
  if (!canUse) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Sessions" />
        <div className="p-8 pt-6">
          <Card>
            <EmptyState icon={<IconSessions width={16} height={16} />} title="You don't have permission to view sessions." />
          </Card>
        </div>
      </div>
    );
  }

  const sessions = await listSessions(company.id, company.organisation_id);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Sessions" description="Every Orex Intelligence conversation for this company -- nothing is hard-deleted by default." />
      <div className="p-8 pt-6">
        <Card>
          {sessions.length === 0 ? (
            <EmptyState icon={<IconSessions width={16} height={16} />} title="No sessions yet." body="Start one from Chat." />
          ) : (
            <SessionTable companySlug={companySlug} sessions={sessions as never} />
          )}
        </Card>
      </div>
    </div>
  );
}
