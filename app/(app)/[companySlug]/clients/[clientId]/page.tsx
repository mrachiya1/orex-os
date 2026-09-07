import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/database/server";
import { Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientHealthBadge } from "@/components/clients/ClientBadges";
import { IconProjects, IconClock, IconSparkle } from "@/components/ui/icons";
import { computeClientHealth } from "@/lib/clients/health";
import { computeClientValue } from "@/lib/clients/value";
import { formatMoney } from "@/lib/finance/currency";

const ACTIVE_STATUSES = new Set(["draft", "planned", "active", "on_hold", "review", "delivery_ready"]);

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ companySlug: string; clientId: string }>;
}) {
  const { companySlug, clientId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: client }, { data: projects }, { data: openIssues }, { data: activity }, { data: latestFeedback }] =
    await Promise.all([
      supabase.from("clients").select("id, last_interaction_at").eq("id", clientId).maybeSingle(),
      supabase
        .from("projects")
        .select("id, name, status, target_date, project_value_minor, currency_code")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false }),
      supabase.from("client_relationship_issues").select("id, reason, type").eq("client_id", clientId).eq("status", "open"),
      supabase
        .from("client_activity")
        .select("id, summary, event_type, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("client_feedback")
        .select("sentiment, content")
        .eq("client_id", clientId)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const allProjects = projects ?? [];
  const activeProjects = allProjects.filter((p) => ACTIVE_STATUSES.has(p.status));
  const completedProjects = allProjects.filter((p) => p.status === "delivered" || p.status === "completed");
  const value = computeClientValue(
    allProjects.map((p) => ({ status: p.status, projectValueMinor: p.project_value_minor, currencyCode: p.currency_code }))
  );

  const daysSince =
    client?.last_interaction_at != null
      ? Math.floor((new Date().getTime() - new Date(client.last_interaction_at).getTime()) / 86400000)
      : null;
  const health = computeClientHealth({
    openIssuesCount: openIssues?.length ?? 0,
    hasLinkedProjects: allProjects.length > 0,
    hasActiveProject: activeProjects.length > 0,
    hasAtRiskProject: false,
    hasBlockedProject: false,
    daysSinceLastInteraction: daysSince,
  });

  const mostCommonCategory = null; // project_type intelligence deferred until enough sample data exists per client

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <SummaryStat label="Active Projects" value={String(activeProjects.length)} />
        <SummaryStat label="Completed Projects" value={String(completedProjects.length)} />
        <SummaryStat
          label="Lifetime Value"
          value={
            value.totalsByCurrency.length === 0
              ? "Not tracked"
              : value.totalsByCurrency.map((t) => formatMoney(t.lifetimeMinor, t.currencyCode)).join(", ")
          }
        />
        <div className="ox-card flex flex-col gap-2 px-4 py-3.5">
          <div className="text-[10.5px] text-[var(--text-muted)]">Relationship Health</div>
          <div><ClientHealthBadge status={health.status} /></div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Current Projects" icon={<IconProjects width={13} height={13} />} href={`/${companySlug}/clients/${clientId}/projects`} actionLabel="View all" />
          <div className="px-5 pb-4">
            {allProjects.length === 0 ? (
              <EmptyState title="No projects linked yet." body="Link a project to this client from the project's Overview tab." />
            ) : (
              <div className="flex flex-col">
                {allProjects.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2.5 text-[12px] last:border-0">
                    <Link href={`/${companySlug}/projects/${p.id}`} className="ox-focus-ring hover:underline">
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="ox-pill ox-pill-neutral">{p.status.replace(/_/g, " ")}</span>
                      <span className="num text-[var(--text-muted)]">
                        {p.project_value_minor != null && p.currency_code ? formatMoney(p.project_value_minor, p.currency_code) : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Client Intelligence" icon={<IconSparkle width={13} height={13} />} />
          <div className="flex flex-col gap-2.5 px-5 pb-4 text-[12px]">
            <IntelligenceRow label="Relationship" value={<ClientHealthBadge status={health.status} />} />
            <IntelligenceRow label="Active Projects" value={String(activeProjects.length)} />
            <IntelligenceRow label="Most Common Work" value={mostCommonCategory ?? "Not enough data yet"} />
            <IntelligenceRow
              label="Recent Feedback"
              value={latestFeedback ? latestFeedback.sentiment : "None recorded"}
            />
            <IntelligenceRow label="Open Concern" value={openIssues && openIssues.length > 0 ? openIssues[0].reason : "None"} />
            {health.reasons.length > 0 && (
              <div className="mt-1 rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-2.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Why</div>
                <ul className="flex flex-col gap-0.5 text-[11px] text-[var(--text-secondary)]">
                  {health.reasons.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader title="Recent Timeline" icon={<IconClock width={13} height={13} />} href={`/${companySlug}/clients/${clientId}/timeline`} actionLabel="View all" />
          <div className="px-5 pb-4">
            {!activity || activity.length === 0 ? (
              <EmptyState title="No activity yet." />
            ) : (
              <div className="flex flex-col">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2 text-[12px] last:border-0">
                    <span className="text-[var(--text-primary)]">{a.summary}</span>
                    <span className="num text-[10.5px] text-[var(--text-muted)]">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ox-card flex flex-col gap-2 px-4 py-3.5">
      <div className="text-[10.5px] text-[var(--text-muted)]">{label}</div>
      <div className="num text-[18px] font-semibold leading-none text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function IntelligenceRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
