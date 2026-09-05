"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/database/server";
import { setMyProjectViewSchema } from "@/lib/validation/project-properties";

export interface ProjectViewConfiguration {
  visibleColumns: string[];
  order: string[];
}

/**
 * V1 is one view per (user, company) -- not a multi-view picker (see
 * prompts/007 "Remaining Gaps"). Returns null when the user has never saved
 * a custom view, so the caller falls back to the built-in default.
 */
export async function getMyProjectView(companyId: string): Promise<ProjectViewConfiguration | null> {
  const user = await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_views")
    .select("configuration")
    .eq("company_id", companyId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.configuration as ProjectViewConfiguration) ?? null;
}

export async function setMyProjectView(input: unknown) {
  const parsed = setMyProjectViewSchema.parse(input);
  const user = await requireCurrentUser();
  const canRead = await hasPermission(parsed.companyId, PERMISSIONS.PROJECTS_READ);
  if (!canRead) throw new Error("Forbidden");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("project_views").upsert(
    {
      organisation_id: parsed.organisationId,
      company_id: parsed.companyId,
      owner_id: user.id,
      configuration: parsed.configuration,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,owner_id" }
  );
  if (error) throw new Error(error.message);
}
