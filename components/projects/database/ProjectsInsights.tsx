import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { urgencyBadge } from "@/lib/projects/urgency";
import { urgentAndUpcoming, type InsightProject } from "@/lib/projects/insights";
import { IconAlert, IconClock, IconProjects, IconMeetings } from "@/components/ui/icons";

/**
 * The compact intelligence strip + "Urgent & Upcoming" list above the
 * Projects table. Every number here is a real count over the same project
 * rows the table renders -- nothing here is fabricated, and a card whose
 * source data doesn't exist yet (Project Value in Pipeline, Reviews
 * Needed -- both need schema not part of this pass) is simply omitted
 * rather than shown with a fake or misleading value.
 */
export function ProjectsInsights({
  projects,
  pendingRequestCount,
  companySlug,
}: {
  projects: InsightProject[];
  pendingRequestCount: number;
  companySlug: string;
}) {
  const active = projects.filter((p) => p.status === "active").length;
  const urgentCount = projects.filter((p) => !["completed", "archived", "cancelled", "delivered"].includes(p.status)).length;
  const nearDeadlineCount = projects.filter((p) => urgencyBadge({ status: p.status, priority: p.priority, targetDate: p.target_date }) !== null).length;
  const attention = urgentAndUpcoming(projects, 5);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InsightCard icon={<IconAlert width={14} height={14} />} label="Urgent Projects" value={urgentCount} sub="Require immediate attention" tone="danger" />
        <InsightCard icon={<IconClock width={14} height={14} />} label="Near Deadlines" value={nearDeadlineCount} sub="Due within 7 days" tone="warning" />
        <InsightCard icon={<IconProjects width={14} height={14} />} label="Active Projects" value={active} />
        <InsightCard icon={<IconMeetings width={14} height={14} />} label="Pending Client Requests" value={pendingRequestCount} tone={pendingRequestCount > 0 ? "info" : undefined} />
      </div>

      {attention.length > 0 && (
        <Card>
          <CardHeader title="Urgent & Upcoming" icon={<IconAlert width={13} height={13} />} />
          <div className="flex flex-col px-2 pb-2">
            {attention.map((p) => {
              const badge = urgencyBadge({ status: p.status, priority: p.priority, targetDate: p.target_date });
              return (
                <Link
                  key={p.id}
                  href={`/${companySlug}/projects/${p.id}`}
                  className="ox-focus-ring flex items-center gap-3 rounded-[var(--radius-s)] px-3 py-2.5 hover:bg-[var(--surface-3)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{p.name}</span>
                    <span className="num block text-[10.5px] text-[var(--text-muted)]">
                      {p.client_display_name ?? p.project_code} · {p.project_code}
                    </span>
                  </span>
                  {badge && (
                    <span className={`ox-pill ${badge === "OVERDUE" ? "ox-pill-danger" : badge === "TODAY" ? "ox-pill-warning" : "ox-pill-info"}`}>{badge}</span>
                  )}
                  <span className="ox-pill ox-pill-neutral capitalize">{p.status.replace(/_/g, " ")}</span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {attention.length === 0 && (
        <EmptyState title="Everything is currently on track." />
      )}
    </div>
  );
}

function InsightCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  tone?: "danger" | "warning" | "info";
}) {
  return (
    <div className="ox-card flex items-start gap-3 px-4 py-3.5">
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-s)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] ${
          tone === "danger" ? "text-[var(--danger)]" : tone === "warning" ? "text-[var(--warning)]" : tone === "info" ? "text-[var(--info)]" : "text-[var(--text-muted)]"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] text-[var(--text-muted)]">{label}</div>
        <div className="num text-[19px] font-semibold leading-tight text-[var(--text-primary)]">{value}</div>
        {sub && <div className="text-[10px] text-[var(--text-muted)]">{sub}</div>}
      </div>
    </div>
  );
}
