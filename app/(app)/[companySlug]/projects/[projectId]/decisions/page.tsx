import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { DecisionLinker } from "@/components/projects/DecisionLinker";

export default async function ProjectDecisionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: rows }, canLink] = await Promise.all([
    supabase.from("decisions").select("id, title, status").eq("project_id", projectId),
    hasProjectAccess(projectId, PERMISSIONS.PROJECTS_UPDATE),
  ]);

  return <DecisionLinker rows={(rows ?? []) as never} projectId={projectId} canLink={canLink} />;
}
