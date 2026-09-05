import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconClock, IconMeetings, IconAudit } from "@/components/ui/icons";

export interface CompanyActivityRow {
  id: string;
  project_id: string;
  project_name: string;
  summary: string;
  created_at: string;
}
export interface DeadlineRow {
  id: string;
  name: string;
  target_date: string;
  priority: string;
}
export interface ClientRequestRow {
  id: string;
  project_id: string;
  project_name: string;
  summary: string;
  approval_state: string;
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ProjectsBottomPanels({
  companySlug,
  activity,
  deadlines,
  requests,
}: {
  companySlug: string;
  activity: CompanyActivityRow[];
  deadlines: DeadlineRow[];
  requests: ClientRequestRow[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
      <Card>
        <CardHeader title="Recent Activity" icon={<IconAudit width={13} height={13} />} />
        <div className="px-5 pb-4">
          {activity.length === 0 ? (
            <EmptyState title="No recent activity." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {activity.map((row) => (
                <li key={row.id} className="text-[12px]">
                  <Link href={`/${companySlug}/projects/${row.project_id}`} className="ox-focus-ring text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <span className="font-semibold text-[var(--text-primary)]">{row.project_name}</span> — {row.summary}
                  </Link>
                  <div className="num mt-0.5 text-[10px] text-[var(--text-muted)]">{relativeTime(row.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Upcoming Deadlines" icon={<IconClock width={13} height={13} />} />
        <div className="px-5 pb-4">
          {deadlines.length === 0 ? (
            <EmptyState title="No upcoming deadlines." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {deadlines.map((row) => (
                <li key={row.id} className="flex items-center justify-between text-[12px]">
                  <Link href={`/${companySlug}/projects/${row.id}`} className="ox-focus-ring truncate text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    {row.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="num text-[10.5px] text-[var(--text-muted)]">{row.target_date}</span>
                    <span className={`ox-pill ${row.priority === "urgent" || row.priority === "high" ? "ox-pill-danger" : "ox-pill-neutral"}`}>{row.priority}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Client Requests" icon={<IconMeetings width={13} height={13} />} />
        <div className="px-5 pb-4">
          {requests.length === 0 ? (
            <EmptyState title="No pending client requests." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {requests.map((row) => (
                <li key={row.id} className="text-[12px]">
                  <Link href={`/${companySlug}/projects/${row.project_id}/scope`} className="ox-focus-ring text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    {row.summary}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[var(--text-muted)]">
                    <span>{row.project_name}</span>
                    <span className={`ox-pill ${row.approval_state === "approved" ? "ox-pill-success" : row.approval_state === "rejected" ? "ox-pill-danger" : "ox-pill-warning"}`}>
                      {row.approval_state}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
