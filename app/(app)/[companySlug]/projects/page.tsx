import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/database/companies";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listPropertyDefinitions } from "@/app/actions/project-properties";
import { getMyProjectView } from "@/app/actions/project-views";
import { listFolders } from "@/app/actions/project-folders";
import { ProjectDatabase, type DbProjectRow } from "@/components/projects/database/ProjectDatabase";
import { ProjectsInsights } from "@/components/projects/database/ProjectsInsights";
import { ProjectsBottomPanels } from "@/components/projects/database/ProjectsBottomPanels";
import { ImportProjectButton } from "@/components/projects/ImportProjectDialog";
import { PageHeader, Card } from "@/components/ui/Surface";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);
  if (!company) notFound();

  const supabase = await createServerSupabaseClient();
  const [{ data: rows }, canCreate, canUpdate, propertyDefinitions, initialView, folders] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, description, project_code, project_type, status, health_state, priority, target_date, start_date, updated_at, client_display_name, lead_id, folder_id"
      )
      .eq("company_id", company.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    hasPermission(company.id, PERMISSIONS.PROJECTS_CREATE),
    hasPermission(company.id, PERMISSIONS.PROJECTS_UPDATE),
    listPropertyDefinitions(company.id),
    getMyProjectView(company.id),
    listFolders(company.id),
  ]);

  const projects = (rows ?? []) as DbProjectRow[];
  const projectIds = projects.map((p) => p.id);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const [
    { data: members },
    { data: propertyValueRows },
    { data: openTasks },
    { data: scopeChanges },
    { data: companyActivity },
  ] = await Promise.all([
    supabase
      .from("company_members")
      .select("user_id, user_profiles(full_name, email)")
      .eq("company_id", company.id)
      .eq("status", "active"),
    projectIds.length
      ? supabase
          .from("project_property_values")
          .select("project_id, property_definition_id, value")
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] as never[] }),
    projectIds.length
      ? supabase
          .from("project_tasks")
          .select("id, project_id, title, due_date")
          .in("project_id", projectIds)
          .neq("status", "done")
          .order("due_date", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as never[] }),
    projectIds.length
      ? supabase
          .from("project_scope_changes")
          .select("id, project_id, summary, approval_state, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    projectIds.length
      ? supabase
          .from("project_activity")
          .select("id, project_id, summary, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const memberList = (members ?? []).map((m) => {
    const profile = Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles;
    return { id: m.user_id, name: profile?.full_name ?? profile?.email ?? "Unknown" };
  });

  const propertyValues: Record<string, Record<string, unknown>> = {};
  for (const row of propertyValueRows ?? []) {
    propertyValues[row.project_id] ??= {};
    propertyValues[row.project_id][row.property_definition_id] = row.value;
  }

  const nextTaskByProject: Record<string, { title: string; due_date: string | null } | null> = {};
  for (const task of openTasks ?? []) {
    if (!nextTaskByProject[task.project_id]) {
      nextTaskByProject[task.project_id] = { title: task.title, due_date: task.due_date };
    }
  }

  const requestCountByProject: Record<string, number> = {};
  const pendingRequests = (scopeChanges ?? []).filter((s) => s.approval_state === "pending");
  for (const s of scopeChanges ?? []) {
    requestCountByProject[s.project_id] = (requestCountByProject[s.project_id] ?? 0) + 1;
  }

  const clientRequestsPanel = pendingRequests.slice(0, 5).map((s) => ({
    id: s.id,
    project_id: s.project_id,
    project_name: projectById.get(s.project_id)?.name ?? "Project",
    summary: s.summary,
    approval_state: s.approval_state,
  }));

  const recentActivityPanel = (companyActivity ?? []).slice(0, 5).map((a) => ({
    id: a.id,
    project_id: a.project_id,
    project_name: projectById.get(a.project_id)?.name ?? "Project",
    summary: a.summary,
    created_at: a.created_at,
  }));

  const DONE = ["completed", "archived", "cancelled", "delivered"];
  const upcomingDeadlines = [...projects]
    .filter((p) => p.target_date && !DONE.includes(p.status))
    .sort((a, b) => (a.target_date ?? "").localeCompare(b.target_date ?? ""))
    .slice(0, 4)
    .map((p) => ({ id: p.id, name: p.name, target_date: p.target_date as string, priority: p.priority }));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader
        title="Projects"
        description="Plan, organize and deliver every company engagement."
        action={
          canCreate ? (
            <ImportProjectButton companyId={company.id} organisationId={company.organisation_id} companySlug={companySlug} />
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4 px-8 pb-8 pt-6">
        <ProjectsInsights projects={projects} pendingRequestCount={pendingRequests.length} companySlug={companySlug} />

        <Card>
          <ProjectDatabase
            companySlug={companySlug}
            companyId={company.id}
            organisationId={company.organisation_id}
            projects={projects}
            members={memberList}
            folders={folders}
            propertyDefinitions={propertyDefinitions as never}
            propertyValues={propertyValues}
            nextTaskByProject={nextTaskByProject}
            requestCountByProject={requestCountByProject}
            initialView={initialView}
            canUpdate={canUpdate}
            canCreate={canCreate}
          />
        </Card>

        <ProjectsBottomPanels
          companySlug={companySlug}
          activity={recentActivityPanel}
          deadlines={upcomingDeadlines}
          requests={clientRequestsPanel}
        />
      </div>
    </div>
  );
}
