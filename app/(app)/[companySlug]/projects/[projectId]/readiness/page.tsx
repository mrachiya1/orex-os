import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { ReadinessChecklist } from "@/components/projects/ReadinessChecklist";

export default async function ReadinessPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: rows }, canUpdate] = await Promise.all([
    supabase
      .from("project_readiness_checks")
      .select("id, title, is_required, status")
      .eq("project_id", projectId)
      .order("sequence"),
    hasProjectAccess(projectId, PERMISSIONS.PROJECTS_UPDATE),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <p className="px-6 pt-4 text-xs text-[var(--muted)]">
        Every required check here, plus every blocking milestone and scope change, must be resolved before this
        project can be marked delivery ready.
      </p>
      <ReadinessChecklist rows={(rows ?? []) as never} projectId={projectId} canUpdate={canUpdate} />
    </div>
  );
}
