import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/auth/session";
import { ensureDefaultWorkspaceSections } from "@/lib/projects/workspace";
import { StatusCell, PriorityCell, HealthCell } from "@/components/projects/database/Cells";
import { ProjectActivityFeed } from "@/components/projects/ProjectActivityFeed";
import { MarkDeliveryReadyAction } from "@/components/projects/MarkDeliveryReadyAction";
import { WorkspaceSection } from "@/components/projects/workspace/WorkspaceSection";
import { SystemSectionCard } from "@/components/projects/workspace/SystemSectionCard";
import { BlockRenderer } from "@/components/projects/workspace/BlockRenderer";
import { AddBlockMenu } from "@/components/projects/workspace/AddBlockMenu";
import { AddSectionForm } from "@/components/projects/workspace/AddSectionForm";
import { Card, CardHeader } from "@/components/ui/Surface";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCheck, IconClock, IconAlert, IconPlus, IconProjects, IconDecisions } from "@/components/ui/icons";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const [
    { data: project },
    { count: openTasks },
    { count: doneTasks },
    { count: overdueTasks },
    { count: incompleteBlockingMilestones },
    { count: pendingScopeChanges },
    { data: recentActivity },
    { data: nextTasks },
    { data: nextMilestone },
    canUpdate,
    canApprove,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, organisation_id, company_id, name, description, scope_summary, objectives, client_display_name, owner_id, lead_id, target_date, start_date, status, health_state, priority, created_at, updated_at"
      )
      .eq("id", projectId)
      .maybeSingle(),
    supabase.from("project_tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId).neq("status", "done"),
    supabase.from("project_tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "done"),
    supabase
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .neq("status", "done")
      .lt("due_date", new Date().toISOString().slice(0, 10)),
    supabase
      .from("project_milestones")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("is_blocking", true)
      .neq("status", "completed"),
    supabase
      .from("project_scope_changes")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("approval_state", "pending"),
    supabase
      .from("project_activity")
      .select("id, event_type, summary, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("project_tasks")
      .select("id, title, due_date, status")
      .eq("project_id", projectId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(3),
    supabase
      .from("project_milestones")
      .select("id, title, due_date, status")
      .eq("project_id", projectId)
      .neq("status", "completed")
      .order("sequence", { ascending: true })
      .limit(1)
      .maybeSingle(),
    hasProjectAccess(projectId, PERMISSIONS.PROJECTS_UPDATE),
    hasProjectAccess(projectId, PERMISSIONS.PROJECTS_APPROVE),
  ]);

  if (!project) notFound();

  const user = await requireCurrentUser();
  if (canUpdate) {
    await ensureDefaultWorkspaceSections({
      projectId: project.id,
      organisationId: project.organisation_id,
      companyId: project.company_id,
      userId: user.id,
    });
  }

  const { data: sections } = await supabase
    .from("project_sections")
    .select("id, title, section_type, system_key, position, is_collapsed, is_hidden")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: blocks } =
    sectionIds.length > 0
      ? await supabase
          .from("project_blocks")
          .select("id, section_id, block_type, position, content")
          .in("section_id", sectionIds)
          .order("position", { ascending: true })
      : { data: [] };

  const blocksBySection = new Map<string, typeof blocks>();
  for (const block of blocks ?? []) {
    const list = blocksBySection.get(block.section_id) ?? [];
    list.push(block);
    blocksBySection.set(block.section_id, list);
  }

  const totalTasks = (openTasks ?? 0) + (doneTasks ?? 0);
  const progressPct = totalTasks > 0 ? Math.round(((doneTasks ?? 0) / totalTasks) * 100) : 0;
  const base = `/${companySlug}/projects/${projectId}`;

  const whatsNext = [
    ...(overdueTasks ? [{ label: `${overdueTasks} overdue task(s)`, tone: "danger" as const }] : []),
    ...(incompleteBlockingMilestones ? [{ label: `${incompleteBlockingMilestones} blocking milestone(s) incomplete`, tone: "warning" as const }] : []),
    ...(pendingScopeChanges ? [{ label: `${pendingScopeChanges} scope change(s) awaiting approval`, tone: "info" as const }] : []),
    ...(nextMilestone ? [{ label: `Next milestone: ${nextMilestone.title}`, tone: "neutral" as const }] : []),
    ...(nextTasks ?? []).map((t) => ({ label: t.title, tone: "neutral" as const })),
  ].slice(0, 5);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* row 1 */}
      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-4">
        <Card>
          <CardHeader title="Overall Progress" icon={<IconCheck width={13} height={13} />} />
          <div className="flex items-center gap-4 px-5 pb-5">
            <ProgressRing pct={progressPct} />
            <div className="flex flex-col gap-1 text-[11.5px]">
              <Stat label="Tasks completed" value={doneTasks ?? 0} />
              <Stat label="Open tasks" value={openTasks ?? 0} />
              <Stat label="Overdue" value={overdueTasks ?? 0} tone={overdueTasks ? "danger" : undefined} />
              <Stat label="Incomplete milestones" value={incompleteBlockingMilestones ?? 0} tone={incompleteBlockingMilestones ? "warning" : undefined} />
              <Stat label="Pending scope changes" value={pendingScopeChanges ?? 0} tone={pendingScopeChanges ? "warning" : undefined} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Timeline" icon={<IconClock width={13} height={13} />} />
          <div className="flex flex-col gap-2 px-5 pb-5 text-[12px]">
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Start</span><span className="num text-[var(--text-secondary)]">{project.start_date ?? "Not set"}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Deadline</span><span className="num text-[var(--text-secondary)]">{project.target_date ?? "Not set"}</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-sunken)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Status & Health" />
          <div className="flex flex-col gap-2.5 px-5 pb-5 text-[12px]">
            <FieldRow label="Status"><StatusCell projectId={project.id} status={project.status} canUpdate={canUpdate} /></FieldRow>
            <FieldRow label="Health"><HealthCell projectId={project.id} health={project.health_state} canUpdate={canUpdate} /></FieldRow>
            <FieldRow label="Priority"><PriorityCell projectId={project.id} priority={project.priority} canUpdate={canUpdate} /></FieldRow>
          </div>
        </Card>

        <Card>
          <CardHeader title="Quick Actions" icon={<IconPlus width={13} height={13} />} />
          <div className="grid grid-cols-1 gap-1.5 px-5 pb-5">
            <QuickAction href={`${base}/milestones`} label="Add milestone" />
            <QuickAction href={`${base}/tasks`} label="Add task" />
            <QuickAction href={`${base}/deliverables`} label="Add deliverable" />
            <QuickAction href={`${base}/scope`} label="Add client request" />
            <QuickAction href={`${base}/decisions`} label="Log decision" icon={<IconDecisions width={12} height={12} />} />
            <QuickAction href={`${base}/team`} label="Manage team" />
            {canApprove && (project.status === "active" || project.status === "review") && (
              <MarkDeliveryReadyAction projectId={project.id} />
            )}
          </div>
        </Card>
      </section>

      {/* row 2 */}
      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <Card>
          <CardHeader title="What's Next" />
          <div className="px-5 pb-5">
            {whatsNext.length === 0 ? (
              <EmptyState title="This project is ready for planning." body="Add milestones, tasks and deliverables to get started." />
            ) : (
              <ul className="flex flex-col gap-2">
                {whatsNext.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                    {item.tone !== "neutral" && <IconAlert width={11} height={11} className={item.tone === "danger" ? "text-[var(--danger)]" : "text-[var(--warning)]"} />}
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Activity" href={`${base}/activity`} actionLabel="View all" />
          <ProjectActivityFeed rows={(recentActivity ?? []) as never} />
        </Card>

        <Card>
          <CardHeader title="Project Details" />
          <div className="flex flex-col gap-2 px-5 pb-5 text-[12px]">
            <DetailRow label="Client" value={project.client_display_name ?? "—"} />
            <DetailRow label="Project value" value="—" />
            <DetailRow label="Start date" value={project.start_date ?? "Not set"} />
            <DetailRow label="Deadline" value={project.target_date ?? "Not set"} />
            <DetailRow label="Created" value={new Date(project.created_at).toLocaleDateString()} />
            <DetailRow label="Last updated" value={new Date(project.updated_at).toLocaleDateString()} />
            <DetailRow label="Last review" value="—" />
            <DetailRow label="Reviewed by" value="—" />
          </div>
        </Card>
      </section>

      {/* row 3: operational workspace (Phase 004.5) */}
      <Card>
        <CardHeader title="Operational Workspace" icon={<IconProjects width={13} height={13} />} />
        <div className="flex flex-col gap-3 px-5 pb-5">
          {(sections ?? []).map((section) => (
            <WorkspaceSection
              key={section.id}
              sectionId={section.id}
              projectId={projectId}
              title={section.title}
              sectionType={section.section_type as "system" | "custom"}
              isCollapsed={section.is_collapsed}
              isHidden={section.is_hidden}
              canEdit={canUpdate}
            >
              {section.section_type === "system" && section.system_key ? (
                <SystemSectionCard systemKey={section.system_key} projectId={projectId} companySlug={companySlug} />
              ) : (
                <>
                  {(blocksBySection.get(section.id) ?? []).map((block) => (
                    <BlockRenderer key={block.id} block={block} projectId={projectId} canEdit={canUpdate} />
                  ))}
                  {canUpdate && <AddBlockMenu projectId={projectId} sectionId={section.id} />}
                </>
              )}
            </WorkspaceSection>
          ))}
          {canUpdate && <AddSectionForm projectId={projectId} />}
        </div>
      </Card>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--border-medium)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--success)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="num text-[16px] font-semibold text-[var(--text-primary)]">{pct}%</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`num font-semibold ${tone === "danger" ? "text-[var(--danger)]" : tone === "warning" ? "text-[var(--warning)]" : "text-[var(--text-secondary)]"}`}>{value}</span>
      <span className="text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="num text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="ox-focus-ring flex items-center gap-2 rounded-[var(--radius-s)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)]"
    >
      {icon ?? <IconPlus width={12} height={12} />}
      {label}
    </Link>
  );
}
