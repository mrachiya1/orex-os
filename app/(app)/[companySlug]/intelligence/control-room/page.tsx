import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getControlRoomSummary } from "@/app/actions/agents";
import { getGlobalAIControls } from "@/lib/ai/agents/global-controls";
import { PageHeader, Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { GlobalControlsPanel } from "@/components/intelligence/GlobalControlsPanel";
import { IconControlRoom } from "@/components/ui/icons";

export default async function ControlRoomPage({
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
        <PageHeader title="Control Room" />
        <div className="p-8 pt-6">
          <Card>
            <EmptyState icon={<IconControlRoom width={16} height={16} />} title="You don't have permission to view the Control Room." />
          </Card>
        </div>
      </div>
    );
  }

  const [summary, controls, canManage] = await Promise.all([
    getControlRoomSummary(company.id),
    getGlobalAIControls(company.id),
    hasPermission(company.id, PERMISSIONS.AGENTS_MANAGE),
  ]);

  const stats: Array<{ label: string; value: string | number }> = [
    { label: "Agents Enabled", value: summary.agentsEnabled },
    { label: "Agents Disabled", value: summary.agentsDisabled },
    { label: "Waiting Approval", value: summary.waitingApproval },
    { label: "Failed Recently", value: summary.failedRecently },
    { label: "AI Spend Today", value: `$${summary.spendToday.toFixed(4)}` },
    { label: "AI Spend This Month", value: `$${summary.spendMonth.toFixed(4)}` },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Control Room" description={`Per-company AI oversight for ${company.name}.`} />
      <div className="flex flex-col gap-4 p-8 pt-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <Card key={s.label}>
              <div className="px-3 py-3">
                <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{s.label}</div>
                <div className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">{s.value}</div>
              </div>
            </Card>
          ))}
        </div>
        <Card>
          <div className="px-1 py-1">
            <GlobalControlsPanel companyId={company.id} controls={controls} canManage={canManage} />
          </div>
        </Card>
      </div>
    </div>
  );
}
