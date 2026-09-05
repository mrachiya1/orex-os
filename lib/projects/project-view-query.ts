import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectViewSourceType } from "@/lib/validation/project-blocks";

export interface ProjectViewConfig {
  sourceType: ProjectViewSourceType;
  displayMode: "list" | "count";
  filter?: { status?: string; approvalState?: string; isBlocking?: boolean };
  sort?: { field: string; direction: "asc" | "desc" };
}

export interface ProjectViewRow {
  id: string;
  label: string;
  meta: string | null;
}

export interface ProjectViewResult {
  rows: ProjectViewRow[];
  count: number;
}

/**
 * Resolves a project_view block's configuration against the real
 * structured Phase 004 tables at render time -- never a copy of the data.
 * Runs through the caller's normal RLS-enforced client, so it is exactly
 * as permission-safe as the dedicated tab pages for the same tables. A
 * fixed switch on sourceType, never a dynamic/interpolated table or column
 * name -- filter/sort fields are already whitelisted by
 * lib/validation/project-blocks.ts before this function ever runs.
 */
export async function resolveProjectView(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  config: ProjectViewConfig
): Promise<ProjectViewResult> {
  const limit = config.displayMode === "count" ? 0 : 10;
  const sortField = config.sort?.field;
  const sortAsc = (config.sort?.direction ?? "asc") === "asc";

  switch (config.sourceType) {
    case "tasks": {
      let query = supabase.from("project_tasks").select("id, title, status, due_date", { count: "exact" }).eq("project_id", projectId);
      if (config.filter?.status) query = query.eq("status", config.filter.status);
      if (sortField) query = query.order(sortField, { ascending: sortAsc });
      const { data, count, error } = await query.limit(limit || 1000);
      if (error) throw new Error(error.message);
      return {
        count: count ?? 0,
        rows: (data ?? []).slice(0, limit || undefined).map((r) => ({ id: r.id, label: r.title, meta: r.status })),
      };
    }
    case "milestones": {
      let query = supabase.from("project_milestones").select("id, title, status, due_date", { count: "exact" }).eq("project_id", projectId);
      if (config.filter?.status) query = query.eq("status", config.filter.status);
      if (config.filter?.isBlocking !== undefined) query = query.eq("is_blocking", config.filter.isBlocking);
      if (sortField) query = query.order(sortField, { ascending: sortAsc });
      const { data, count, error } = await query.limit(limit || 1000);
      if (error) throw new Error(error.message);
      return {
        count: count ?? 0,
        rows: (data ?? []).slice(0, limit || undefined).map((r) => ({ id: r.id, label: r.title, meta: r.status })),
      };
    }
    case "deliverables": {
      let query = supabase
        .from("project_deliverables")
        .select("id, title, approval_state, due_date", { count: "exact" })
        .eq("project_id", projectId);
      if (config.filter?.approvalState) query = query.eq("approval_state", config.filter.approvalState);
      if (sortField) query = query.order(sortField, { ascending: sortAsc });
      const { data, count, error } = await query.limit(limit || 1000);
      if (error) throw new Error(error.message);
      return {
        count: count ?? 0,
        rows: (data ?? []).slice(0, limit || undefined).map((r) => ({ id: r.id, label: r.title, meta: r.approval_state })),
      };
    }
    case "scope_changes": {
      let query = supabase
        .from("project_scope_changes")
        .select("id, summary, approval_state, created_at", { count: "exact" })
        .eq("project_id", projectId);
      if (config.filter?.approvalState) query = query.eq("approval_state", config.filter.approvalState);
      if (sortField) query = query.order(sortField, { ascending: sortAsc });
      const { data, count, error } = await query.limit(limit || 1000);
      if (error) throw new Error(error.message);
      return {
        count: count ?? 0,
        rows: (data ?? []).slice(0, limit || undefined).map((r) => ({ id: r.id, label: r.summary, meta: r.approval_state })),
      };
    }
    case "readiness_checks": {
      let query = supabase
        .from("project_readiness_checks")
        .select("id, title, status, sequence", { count: "exact" })
        .eq("project_id", projectId);
      if (config.filter?.status) query = query.eq("status", config.filter.status);
      if (sortField) query = query.order(sortField, { ascending: sortAsc });
      const { data, count, error } = await query.limit(limit || 1000);
      if (error) throw new Error(error.message);
      return {
        count: count ?? 0,
        rows: (data ?? []).slice(0, limit || undefined).map((r) => ({ id: r.id, label: r.title, meta: r.status })),
      };
    }
  }
}
