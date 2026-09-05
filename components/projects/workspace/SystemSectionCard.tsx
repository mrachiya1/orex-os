import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/database/server";

const SYSTEM_TABLE: Record<string, string> = {
  milestones: "project_milestones",
  tasks: "project_tasks",
  deliverables: "project_deliverables",
  readiness: "project_readiness_checks",
  scope: "project_scope_changes",
};

export async function SystemSectionCard({
  systemKey,
  projectId,
  companySlug,
}: {
  systemKey: string;
  projectId: string;
  companySlug: string;
}) {
  const supabase = await createServerSupabaseClient();
  const tableName = SYSTEM_TABLE[systemKey];

  let summary = "";
  if (tableName) {
    const { count } = await supabase
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    summary = `${count ?? 0} record${count === 1 ? "" : "s"}`;
  } else if (systemKey === "team") {
    const { count } = await supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "active");
    summary = `${count ?? 0} member${count === 1 ? "" : "s"}`;
  } else if (systemKey === "decisions") {
    const { count } = await supabase
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    summary = `${count ?? 0} linked`;
  } else if (systemKey === "activity") {
    const { count } = await supabase
      .from("project_activity")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    summary = `${count ?? 0} events`;
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--muted)]">{summary}</span>
      <Link
        href={`/${companySlug}/projects/${projectId}/${systemKey}`}
        className="text-xs text-[var(--accent)] hover:underline"
      >
        View full {systemKey} →
      </Link>
    </div>
  );
}
