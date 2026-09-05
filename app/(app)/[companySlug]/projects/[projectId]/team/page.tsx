import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { ProjectMemberTable } from "@/components/projects/ProjectMemberTable";
import { ProjectMemberForm } from "@/components/projects/ProjectMemberForm";

export default async function ProjectTeamPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: project } = await supabase.from("projects").select("company_id").eq("id", projectId).maybeSingle();
  if (!project) notFound();

  const [{ data: rows }, { data: companyMembers }, canManage] = await Promise.all([
    supabase
      .from("project_members")
      .select("id, project_role, status, user_profiles(full_name, email)")
      .eq("project_id", projectId),
    supabase
      .from("company_members")
      .select("user_id, user_profiles(id, full_name, email)")
      .eq("company_id", project.company_id)
      .eq("status", "active"),
    hasProjectAccess(projectId, PERMISSIONS.PROJECTS_ASSIGN),
  ]);

  const candidateMembers = (companyMembers ?? [])
    .map((m) => (Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles))
    .filter((p): p is { id: string; full_name: string | null; email: string | null } => Boolean(p));

  return (
    <div className="flex flex-1 flex-col">
      {canManage && (
        <div className="border-b border-[var(--border)]">
          <ProjectMemberForm projectId={projectId} members={candidateMembers} />
        </div>
      )}
      <ProjectMemberTable rows={(rows ?? []) as never} projectId={projectId} canManage={canManage} />
    </div>
  );
}
