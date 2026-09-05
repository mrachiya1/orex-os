import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { DeliverableTable } from "@/components/projects/DeliverableTable";
import { DeliverableForm } from "@/components/projects/DeliverableForm";

export default async function DeliverablesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: rows }, canCreate, canApprove, canDeliver] = await Promise.all([
    supabase
      .from("project_deliverables")
      .select("id, title, deliverable_type, status, approval_state, is_required, reference_url")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    hasProjectAccess(projectId, PERMISSIONS.DELIVERABLES_CREATE),
    hasProjectAccess(projectId, PERMISSIONS.DELIVERABLES_APPROVE),
    hasProjectAccess(projectId, PERMISSIONS.DELIVERABLES_DELIVER),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      {canCreate && (
        <div className="border-b border-[var(--border)]">
          <DeliverableForm projectId={projectId} />
        </div>
      )}
      <DeliverableTable
        rows={(rows ?? []) as never}
        projectId={projectId}
        canApprove={canApprove}
        canDeliver={canDeliver}
      />
    </div>
  );
}
