import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listSessions } from "@/app/actions/sessions";
import { PageHeader, Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewChatForm } from "@/components/intelligence/NewChatForm";
import { SessionListLinks } from "@/components/intelligence/SessionListLinks";
import { IconAdvisor } from "@/components/ui/icons";

export default async function IntelligenceChatPage({
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
        <PageHeader title="Orex Intelligence" />
        <div className="p-8 pt-6">
          <Card>
            <EmptyState icon={<IconAdvisor width={16} height={16} />} title="You don't have permission to use AI agents in this company." />
          </Card>
        </div>
      </div>
    );
  }

  const sessions = await listSessions(company.id, company.organisation_id);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Orex Intelligence" description="Ask, analyze, plan or command Orex OS." />
      <div className="grid grid-cols-1 gap-4 p-8 pt-6 md:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title="New session" />
          <NewChatForm organisationId={company.organisation_id} companyId={company.id} companySlug={companySlug} />
        </Card>
        <Card>
          <CardHeader title="Recent sessions" href={`/${companySlug}/intelligence/sessions`} actionLabel="View all" />
          {sessions.length === 0 ? (
            <EmptyState icon={<IconAdvisor width={16} height={16} />} title="No sessions yet." />
          ) : (
            <SessionListLinks companySlug={companySlug} sessions={sessions.slice(0, 8) as never} />
          )}
        </Card>
      </div>
    </div>
  );
}
