import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyBySlug } from "@/lib/database/companies";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listAgents, getAgentSpend } from "@/app/actions/agents";
import { PageHeader, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgentCard } from "@/components/intelligence/AgentCard";
import { IconAgents } from "@/components/ui/icons";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const canRead = await hasPermission(company.id, PERMISSIONS.AGENTS_READ);
  if (!canRead) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Agents" />
        <div className="p-8 pt-6">
          <Card>
            <EmptyState icon={<IconAgents width={16} height={16} />} title="You don't have permission to view agents." />
          </Card>
        </div>
      </div>
    );
  }

  const [agents, canManage] = await Promise.all([
    listAgents(company.id),
    hasPermission(company.id, PERMISSIONS.AGENTS_MANAGE),
  ]);
  const spends = await Promise.all(agents.map((a) => getAgentSpend(company.id, a.agentId)));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] px-8 py-3 text-[12px] text-[var(--text-muted)]">
        <Link href={`/${companySlug}/intelligence`} className="ox-focus-ring hover:text-[var(--text-primary)]">
          Orex Intelligence
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)]">Manage Agents</span>
      </div>
      <PageHeader title="Agents" description="Every AI agent configured for this organisation." />
      <div className="grid grid-cols-1 gap-4 p-8 pt-6 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent, i) => (
          <AgentCard key={agent.agentId} companyId={company.id} agent={agent} spend={spends[i]} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}
