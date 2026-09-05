import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/database/server";
import { hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { MilestoneTree } from "@/components/projects/MilestoneTree";
import { Card, CardHeader } from "@/components/ui/Surface";
import { IconProjects } from "@/components/ui/icons";
import type { FlatMilestone, FlatTask } from "@/lib/projects/milestone-tree";

export default async function MilestonesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: milestones, error }, { data: tasks }, canUpdate] = await Promise.all([
    supabase
      .from("project_milestones")
      .select("id, parent_milestone_id, title, status, is_blocking, due_date, sequence")
      .eq("project_id", projectId)
      .order("sequence"),
    supabase
      .from("project_tasks")
      .select("id, milestone_id, title, status, due_date, assignee_user_id")
      .eq("project_id", projectId),
    hasProjectAccess(projectId, PERMISSIONS.PROJECTS_UPDATE),
  ]);
  if (error) notFound();

  return (
    <Card>
      <CardHeader title="Project Breakdown" icon={<IconProjects width={13} height={13} />} />
      <div className="px-4 pb-4 pt-2">
        <MilestoneTree
          projectId={projectId}
          milestones={(milestones ?? []) as FlatMilestone[]}
          tasks={(tasks ?? []) as FlatTask[]}
          canUpdate={canUpdate}
        />
      </div>
    </Card>
  );
}
