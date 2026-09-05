import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { ScopeChangeTable } from "@/components/projects/ScopeChangeTable";
import { ScopeChangeForm } from "@/components/projects/ScopeChangeForm";

export default async function ScopePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: rows }, canCreate, canApprove] = await Promise.all([
    supabase
      .from("project_scope_changes")
      .select("id, summary, approval_state, is_blocking, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    hasProjectAccess(projectId, PERMISSIONS.SCOPE_CHANGES_CREATE),
    hasProjectAccess(projectId, PERMISSIONS.SCOPE_CHANGES_APPROVE),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      {canCreate && (
        <div className="border-b border-[var(--border)]">
          <ScopeChangeForm projectId={projectId} />
        </div>
      )}
      <ScopeChangeTable rows={(rows ?? []) as never} projectId={projectId} canApprove={canApprove} />
    </div>
  );
}
