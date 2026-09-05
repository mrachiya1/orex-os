import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { StatusCell, PriorityCell, HealthCell, AssignedCell, ClientCell, CategoryCell, DateCell } from "@/components/projects/database/Cells";
import { IconProjects } from "@/components/ui/icons";

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: project }, canUpdate] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, company_id, name, description, project_code, project_type, status, health_state, priority, target_date, start_date, client_display_name, lead_id"
      )
      .eq("id", projectId)
      .maybeSingle(),
    hasProjectAccess(projectId, PERMISSIONS.PROJECTS_UPDATE),
  ]);

  if (!project) notFound();

  const { data: members } = await supabase
    .from("company_members")
    .select("user_id, user_profiles(full_name, email)")
    .eq("company_id", project.company_id)
    .eq("status", "active");
  const memberList = (members ?? []).map((m) => {
    const profile = Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles;
    return { id: m.user_id, name: profile?.full_name ?? profile?.email ?? "Unknown" };
  });

  const base = `/${companySlug}/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/milestones`, label: "Milestones" },
    { href: `${base}/tasks`, label: "Tasks" },
    { href: `${base}/deliverables`, label: "Deliverables" },
    { href: `${base}/readiness`, label: "Readiness" },
    { href: `${base}/scope`, label: "Scope" },
    { href: `${base}/activity`, label: "Activity" },
    { href: `${base}/team`, label: "Team" },
    { href: `${base}/decisions`, label: "Decisions" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] px-8 py-3 text-[12px] text-[var(--text-muted)]">
        <Link href={`/${companySlug}/projects`} className="ox-focus-ring hover:text-[var(--text-primary)]">
          Projects
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)]">{project.name}</span>
      </div>

      <div className="border-b border-[var(--border-subtle)] px-8 py-6">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-raised)] text-[var(--text-muted)]">
            <IconProjects width={22} height={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[19px] font-semibold text-[var(--text-primary)]">{project.name}</h1>
              <StatusCell projectId={project.id} status={project.status} canUpdate={canUpdate} />
              <HealthCell projectId={project.id} health={project.health_state} canUpdate={canUpdate} />
            </div>
            <p className="mt-1 max-w-2xl text-[12.5px] text-[var(--text-muted)]">
              {project.description || "No headline yet."}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <PrimaryField label="Client">
                <ClientCell projectId={project.id} clientDisplayName={project.client_display_name} canUpdate={canUpdate} />
              </PrimaryField>
              <PrimaryField label="Assigned">
                <AssignedCell projectId={project.id} leadId={project.lead_id} members={memberList} canUpdate={canUpdate} />
              </PrimaryField>
              <PrimaryField label="Start">
                <DateCell projectId={project.id} field="startDate" value={project.start_date} canUpdate={canUpdate} />
              </PrimaryField>
              <PrimaryField label="Deadline">
                <DateCell projectId={project.id} field="targetDate" value={project.target_date} canUpdate={canUpdate} />
              </PrimaryField>
              <PrimaryField label="Priority">
                <PriorityCell projectId={project.id} priority={project.priority} canUpdate={canUpdate} />
              </PrimaryField>
              <PrimaryField label="Category">
                <CategoryCell projectId={project.id} projectType={project.project_type} canUpdate={canUpdate} suggestions={[]} />
              </PrimaryField>
              <PrimaryField label="Code">
                <span className="num text-[12px] text-[var(--text-secondary)]">{project.project_code}</span>
              </PrimaryField>
            </div>
          </div>
        </div>
      </div>

      <ProjectTabs base={base} tabs={tabs} />
      <div className="flex-1 overflow-x-auto px-8 py-6">{children}</div>
    </div>
  );
}

function PrimaryField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
