import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listSessions } from "@/app/actions/sessions";
import { listAgents } from "@/app/actions/agents";
import { getControlRoomSummary } from "@/app/actions/agents";
import { getIntelligenceContext } from "@/lib/intelligence/context";
import { Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { IntelligenceWorkspace } from "@/components/intelligence/IntelligenceWorkspace";
import { IconSparkle } from "@/components/ui/icons";

/**
 * The Orex Intelligence landing page (prompts/015). No title/session setup
 * form -- the first message auto-creates a session (IntelligenceWorkspace's
 * ensureSession) and the URL becomes /intelligence/chat/[id] once it does.
 */
export default async function IntelligencePage({
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
      <div className="flex flex-1 items-center justify-center p-8">
        <Card>
          <EmptyState icon={<IconSparkle width={16} height={16} />} title="You don't have permission to use AI agents in this company." />
        </Card>
      </div>
    );
  }

  const [sessions, agents, contextSummary, controlRoomSummary] = await Promise.all([
    listSessions(company.id, company.organisation_id),
    listAgents(company.id),
    getIntelligenceContext(company.id),
    getControlRoomSummary(company.id).catch(() => ({ spendToday: 0 })),
  ]);

  return (
    <IntelligenceWorkspace
      companySlug={companySlug}
      organisationId={company.organisation_id}
      companyId={company.id}
      companyName={company.name}
      sessionId={null}
      initialMessages={[]}
      agents={agents.map((a) => ({ agentId: a.agentId, name: a.name, enabled: a.enabled }))}
      contextSummary={contextSummary}
      historySessions={sessions as never}
      spendToday={controlRoomSummary.spendToday}
    />
  );
}
