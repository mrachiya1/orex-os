import { requireCurrentUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { TaskTable } from "@/components/projects/TaskTable";
import { TaskForm } from "@/components/projects/TaskForm";

export default async function TasksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireCurrentUser();
  const supabase = await createServerSupabaseClient();

  const [{ data: rows }, canUpdate] = await Promise.all([
    supabase
      .from("project_tasks")
      .select("id, title, status, priority, due_date, assignee_user_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    hasProjectAccess(projectId, PERMISSIONS.PROJECTS_UPDATE),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      {canUpdate && (
        <div className="border-b border-[var(--border)]">
          <TaskForm projectId={projectId} />
        </div>
      )}
      <TaskTable rows={(rows ?? []) as never} projectId={projectId} currentUserId={user.id} canUpdate={canUpdate} />
    </div>
  );
}
