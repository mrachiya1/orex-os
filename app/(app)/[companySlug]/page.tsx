import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyBySlug } from "@/lib/database/companies";
import { getSidebarIdentity } from "@/lib/database/profile";
import { requireCurrentUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/database/server";
import { LiveClock } from "@/components/shell/LiveClock";
import { Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconToday,
  IconDecisions,
  IconClock,
  IconProjects,
  IconDelivery,
  IconSparkle,
  IconCheck,
} from "@/components/ui/icons";

const ONGOING_STATUSES = ["draft", "planned", "active", "on_hold", "review", "delivery_ready"] as const;

const ACTIVITY_TONE: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  "project.created": "info",
  "project.updated": "neutral",
  status_changed: "info",
  health_changed: "warning",
  delivery_ready: "success",
  delivered: "success",
  "deliverable.approved": "success",
  "milestone.created": "neutral",
  "task.created": "neutral",
  "readiness_check.completed": "success",
  "scope_change.approved": "success",
  "scope_change.recorded": "warning",
  "member.added": "info",
  "member.removed": "neutral",
  "decision.linked": "info",
};

function activityTone(eventType: string) {
  return ACTIVITY_TONE[eventType] ?? "neutral";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function firstName(fullName: string | null, email: string | null): string {
  if (fullName) return fullName.trim().split(/\s+/)[0];
  if (email) return email.split("@")[0];
  return "there";
}

export default async function TodayPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const user = await requireCurrentUser();
  const supabase = await createServerSupabaseClient();

  const [{ displayName, roleLabel }, { data: organisation }] = await Promise.all([
    getSidebarIdentity(user, company.id, company.organisation_id),
    supabase.from("organisations").select("name").eq("id", company.organisation_id).maybeSingle(),
  ]);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, project_code, status, target_date")
    .eq("company_id", company.id)
    .in("status", ONGOING_STATUSES);

  const projectIds = (projects ?? []).map((p) => p.id);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  const [{ data: tasks }, { data: decisions }, { data: activity }, { count: pendingDeliverablesCount }] =
    await Promise.all([
      projectIds.length
        ? supabase
            .from("project_tasks")
            .select("id, title, status, due_date, priority, project_id, assignee_user_id")
            .in("project_id", projectIds)
            .neq("status", "done")
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("decisions")
        .select("id, title, status, situation")
        .eq("company_id", company.id)
        .in("status", ["proposed", "in_review"])
        .order("created_at", { ascending: false })
        .limit(3),
      projectIds.length
        ? supabase
            .from("project_activity")
            .select("id, project_id, event_type, summary, created_at")
            .in("project_id", projectIds)
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as never[] }),
      projectIds.length
        ? supabase
            .from("project_deliverables")
            .select("id", { count: "exact", head: true })
            .in("project_id", projectIds)
            .eq("approval_state", "pending")
        : Promise.resolve({ count: 0 }),
    ]);

  const openTasks = tasks ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < today);
  const dueToday = openTasks.filter((t) => t.due_date === today);
  const blocked = openTasks.filter((t) => t.status === "blocked");

  const priorityTasks = [...openTasks]
    .filter((t) => t.assignee_user_id === user.id || (t.due_date && t.due_date <= today))
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    })
    .slice(0, 5);

  const activeProjectCount = (projects ?? []).filter((p) => p.status === "active").length;

  const deliveryRows = [...(projects ?? [])]
    .filter((p) => ["active", "review", "delivery_ready"].includes(p.status))
    .sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"))
    .slice(0, 5);

  const orgName = organisation?.name ?? "Orex Group";

  return (
    <div className="flex flex-1 flex-col gap-4 px-8 py-6">
      {/* hero */}
      <section className="relative overflow-hidden rounded-[var(--radius-l)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-8 py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 160% at 88% -20%, var(--accent-dim), transparent 55%), linear-gradient(180deg, var(--surface-2) 0%, var(--surface-1) 70%)",
          }}
        />
        <div className="relative flex items-start justify-between gap-6">
          <div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <h1 className="font-display mt-2 text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
              Ayubowan {firstName(displayName, user.email)}. <span className="font-sans">👋</span>
            </h1>
            <p className="font-display mt-0.5 text-[16px] italic text-[var(--text-secondary)]">Suba dawasak.</p>
            <p className="mt-2 max-w-md text-[12.5px] text-[var(--text-muted)]">
              Disciplined progress today builds the extraordinary tomorrow.
            </p>
            <div className="mt-3 flex gap-2">
              {roleLabel && <span className="ox-pill ox-pill-neutral">{roleLabel}</span>}
              <span className="ox-pill ox-pill-neutral">{orgName}</span>
            </div>
          </div>
          <LiveClock />
        </div>
      </section>

      {/* focus row */}
      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-4">
        <div className="ox-card relative flex flex-col justify-between overflow-hidden px-5 py-4.5 lg:col-span-1">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">Today</div>
            <p className="font-display max-w-[240px] text-[19px] font-medium leading-snug text-[var(--text-primary)]">
              A day for deep work and real progress.
            </p>
            <p className="mt-2 max-w-[260px] text-[12px] text-[var(--text-muted)]">
              Small consistent steps create big outcomes. Stay focused, make good decisions, and keep building what
              matters.
            </p>
          </div>
          <p className="font-display mt-4 border-l-2 border-[var(--border-strong)] pl-2.5 text-[12px] italic text-[var(--text-secondary)]">
            &ldquo;Progress today, a stronger tomorrow.&rdquo;
          </p>
        </div>

        <Card>
          <CardHeader title="Top Priorities" icon={<IconToday width={13} height={13} />} />
          <div className="px-5 pb-4">
            {priorityTasks.length === 0 ? (
              <EmptyState title="Nothing urgent." body="No overdue or due-today tasks assigned to you." />
            ) : (
              <div className="flex flex-col">
                {priorityTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] py-2 text-[12px] last:border-0">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border border-[var(--border-medium)] text-[var(--text-muted)]">
                      {t.status === "blocked" && <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />}
                    </span>
                    <span className="flex-1 truncate text-[var(--text-primary)]">{t.title}</span>
                    {t.due_date && (
                      <span className={`num text-[10.5px] ${t.due_date < today ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                        {t.due_date}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Needs Your Decision"
            icon={<IconDecisions width={13} height={13} />}
            action={<span className="ox-pill ox-pill-neutral">{decisions?.length ?? 0}</span>}
          />
          <div className="px-5 pb-4">
            {!decisions || decisions.length === 0 ? (
              <EmptyState title="No decisions need your attention." />
            ) : (
              <div className="flex flex-col gap-2">
                {decisions.map((d) => (
                  <Link
                    key={d.id}
                    href={`/${companySlug}/brain/decisions/${d.id}`}
                    className="ox-focus-ring block rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2.5 hover:border-[var(--border-medium)]"
                  >
                    <div className="text-[12px] font-semibold text-[var(--text-primary)]">{d.title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{d.situation}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Today Status" icon={<IconCheck width={13} height={13} />} />
          <div className="flex flex-col gap-2.5 px-5 pb-4">
            <StatusRow label="Overdue" value={overdue.length} tone={overdue.length > 0 ? "danger" : "neutral"} />
            <StatusRow label="Due today" value={dueToday.length} tone={dueToday.length > 0 ? "warning" : "neutral"} />
            <StatusRow label="Blocked" value={blocked.length} tone={blocked.length > 0 ? "danger" : "neutral"} />
            <StatusRow
              label="Waiting approval"
              value={pendingDeliverablesCount ?? 0}
              tone={(pendingDeliverablesCount ?? 0) > 0 ? "info" : "neutral"}
            />
          </div>
        </Card>
      </section>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard icon={<IconProjects width={14} height={14} />} label="Active Projects" value={String(activeProjectCount)} sub={`${(projects ?? []).length} ongoing total`} />
        <KpiCard label="Meetings Today" placeholder />
        <KpiCard label="Estimated Income" placeholder />
        <KpiCard label="Risks" placeholder />
        <KpiCard label="Opportunities" placeholder />
      </section>

      {/* operational grid */}
      <section className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Today's Timeline" icon={<IconClock width={13} height={13} />} />
          <div className="px-5 pb-5">
            <EmptyState
              icon={<IconClock width={16} height={16} />}
              title="Today's Timeline"
              body="Calendar integration will appear here once Meetings is connected."
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Project Updates" icon={<IconProjects width={13} height={13} />} href={`/${companySlug}/projects`} actionLabel="View all projects" />
          <div className="px-5 pb-4">
            {!activity || activity.length === 0 ? (
              <EmptyState title="No recent activity." body="Project updates will appear here as work happens." />
            ) : (
              <div className="flex flex-col">
                {activity.map((row) => {
                  const project = projectById.get(row.project_id);
                  const tone = activityTone(row.event_type);
                  return (
                    <div key={row.id} className="flex gap-2.5 border-b border-[var(--border-subtle)] py-2.5 last:border-0">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background:
                            tone === "success"
                              ? "var(--success)"
                              : tone === "danger"
                                ? "var(--danger)"
                                : tone === "warning"
                                  ? "var(--warning)"
                                  : "var(--info)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                          {project?.name ?? "Project"}
                        </div>
                        <div className="truncate text-[11px] text-[var(--text-muted)]">{row.summary}</div>
                        <div className="mt-1 num text-[10px] text-[var(--text-muted)]">{relativeTime(row.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="AI Suggestions" icon={<IconSparkle width={13} height={13} />} />
          <div className="px-5 pb-5">
            <EmptyState
              icon={<IconSparkle width={16} height={16} />}
              title="Orex Intelligence isn't active yet."
              body="Evidence-backed recommendations will surface here once Performance Intelligence is available."
            />
          </div>
        </Card>
      </section>

      {/* bottom row */}
      <section className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Finance Pulse" />
          <div className="px-5 pb-5">
            <EmptyState title="Finance intelligence becomes available once Finance is connected." />
          </div>
        </Card>

        <Card>
          <CardHeader title="Delivery Ready / Upcoming Deadlines" icon={<IconDelivery width={13} height={13} />} href={`/${companySlug}/delivery-ready`} actionLabel="View all" />
          {deliveryRows.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState title="No projects currently approaching delivery." />
            </div>
          ) : (
            <table className="ox-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Target date</th>
                </tr>
              </thead>
              <tbody>
                {deliveryRows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/${companySlug}/projects/${p.id}`} className="ox-focus-ring hover:underline">
                        {p.name}
                      </Link>
                      <span className="ml-2 num text-[10.5px] text-[var(--text-muted)]">{p.project_code}</span>
                    </td>
                    <td>
                      <span className="ox-pill ox-pill-neutral">{p.status.replace("_", " ")}</span>
                    </td>
                    <td className="num text-[var(--text-secondary)]">{p.target_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={`ox-pill ox-pill-${tone === "neutral" ? "neutral" : tone}`}>{value}</span>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  placeholder,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  sub?: string;
  placeholder?: boolean;
}) {
  return (
    <div className="ox-card flex flex-col gap-2 px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="grid h-6 w-6 place-items-center rounded-[var(--radius-s)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)]">
          {icon}
        </div>
      </div>
      <div className="text-[10.5px] text-[var(--text-muted)]">{label}</div>
      {placeholder ? (
        <div className="text-[12px] text-[var(--text-muted)]">Not connected yet</div>
      ) : (
        <>
          <div className="num text-[22px] font-semibold leading-none text-[var(--text-primary)]">{value}</div>
          {sub && <div className="text-[10.5px] text-[var(--text-muted)]">{sub}</div>}
        </>
      )}
    </div>
  );
}
