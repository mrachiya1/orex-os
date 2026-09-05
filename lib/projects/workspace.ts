import "server-only";
import { createServerSupabaseClient } from "@/lib/database/server";

export const DEFAULT_CUSTOM_SECTIONS = ["Project Summary", "Current Work", "Delivery"] as const;

export const DEFAULT_SYSTEM_SECTIONS: Array<{ key: string; title: string }> = [
  { key: "milestones", title: "Milestones" },
  { key: "tasks", title: "Tasks" },
  { key: "deliverables", title: "Deliverables" },
  { key: "readiness", title: "Readiness" },
  { key: "scope", title: "Scope" },
  { key: "team", title: "Team" },
  { key: "decisions", title: "Decisions" },
  { key: "activity", title: "Activity" },
];

/**
 * Seeds the default workspace (3 empty custom sections + 8 system-section
 * presentation rows) for a project that has none yet -- called both by
 * createProject() for new projects and lazily by the Overview page for
 * projects created before this table existed (Phase 004's manual-testing
 * projects). Idempotent: does nothing if the project already has any
 * project_sections rows.
 */
export async function ensureDefaultWorkspaceSections(params: {
  projectId: string;
  organisationId: string;
  companyId: string | null;
  userId: string;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { count, error: countError } = await supabase
    .from("project_sections")
    .select("id", { count: "exact", head: true })
    .eq("project_id", params.projectId);
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  let position = 0;
  const rows = [
    ...DEFAULT_CUSTOM_SECTIONS.map((title) => ({
      organisation_id: params.organisationId,
      company_id: params.companyId,
      project_id: params.projectId,
      title,
      section_type: "custom" as const,
      system_key: null,
      position: position++,
      created_by: params.userId,
    })),
    ...DEFAULT_SYSTEM_SECTIONS.map(({ key, title }) => ({
      organisation_id: params.organisationId,
      company_id: params.companyId,
      project_id: params.projectId,
      title,
      section_type: "system" as const,
      system_key: key,
      position: position++,
      created_by: params.userId,
    })),
  ];

  const { error } = await supabase.from("project_sections").insert(rows);
  if (error) throw new Error(error.message);
}
