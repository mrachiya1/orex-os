import { createServerSupabaseClient } from "@/lib/database/server";
import { ProjectActivityFeed } from "@/components/projects/ProjectActivityFeed";

export default async function ActivityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: rows } = await supabase
    .from("project_activity")
    .select("id, event_type, summary, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  return <ProjectActivityFeed rows={(rows ?? []) as never} />;
}
