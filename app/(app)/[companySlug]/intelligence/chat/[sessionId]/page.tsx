import { notFound } from "next/navigation";
import { getSession, listSessions } from "@/app/actions/sessions";
import { listMessages } from "@/app/actions/messages";
import { listAgents, getControlRoomSummary, getRecentActivity } from "@/app/actions/agents";
import { getIntelligenceContext } from "@/lib/intelligence/context";
import { IntelligenceWorkspace } from "@/components/intelligence/IntelligenceWorkspace";
import { getCompanyBySlug } from "@/lib/database/companies";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ companySlug: string; sessionId: string }>;
}) {
  const { companySlug, sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const [messages, sessions, agents, contextSummary, controlRoomSummary, canManageAgents, recentActivity] =
    await Promise.all([
      listMessages(sessionId),
      listSessions(session.company_id, session.organisation_id),
      listAgents(company.id),
      getIntelligenceContext(company.id),
      getControlRoomSummary(company.id).catch(() => ({ spendToday: 0 })),
      hasPermission(company.id, PERMISSIONS.AGENTS_ENABLE),
      getRecentActivity(company.id).catch(() => []),
    ]);

  return (
    <IntelligenceWorkspace
      companySlug={companySlug}
      organisationId={session.organisation_id}
      companyId={company.id}
      companyName={company.name}
      sessionId={sessionId}
      initialMessages={messages as never}
      agents={agents.map((a) => ({ agentId: a.agentId, name: a.name, enabled: a.enabled }))}
      contextSummary={contextSummary}
      historySessions={sessions as never}
      spendToday={controlRoomSummary.spendToday}
      canManageAgents={canManageAgents}
      recentActivity={recentActivity}
    />
  );
}
