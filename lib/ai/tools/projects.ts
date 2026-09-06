import { createServerSupabaseClient } from "@/lib/database/server";
import { PERMISSIONS } from "@/lib/permissions";
import { createTask } from "@/app/actions/project-tasks";
import { createTaskSchema } from "@/lib/validation/projects";
import { projectsSearchInputSchema } from "./schemas";
import type { ToolDefinition } from "./types";

export interface ProjectSearchResult {
  id: string;
  name: string;
  projectCode: string;
  status: string;
  priority: string;
  targetDate: string | null;
}

/**
 * LEVEL 0 (read only). Scoped to the caller's own company -- the normal
 * authenticated client is used (never service-role), so RLS's own
 * has_project_access(..., 'projects.read') check is what actually limits
 * the rows returned; authorizeToolCall's hasPermission check is the
 * up-front, fail-fast version of the same rule.
 */
const projectsSearch: ToolDefinition<{ companyId: string; query: string }, ProjectSearchResult[]> = {
  name: "projects.search",
  description: "Search this company's projects by name or project code. Read-only.",
  domain: "projects",
  requiredPermission: PERMISSIONS.PROJECTS_READ,
  scopeType: "company",
  riskLevel: 0,
  inputSchema: projectsSearchInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, project_code, status, priority, target_date")
      .eq("company_id", input.companyId)
      .or(`name.ilike.%${input.query}%,project_code.ilike.%${input.query}%`)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      projectCode: p.project_code,
      status: p.status,
      priority: p.priority,
      targetDate: p.target_date,
    }));
  },
};

/**
 * LEVEL 1 (safe update). The handler is the real createTask action verbatim
 * -- not a reimplementation -- so permission checks, lifecycle rules,
 * audit_logs, and project_activity are byte-for-byte identical to a human
 * creating this same task by hand (prompts/013-ai-action-engine.md
 * Decisions #1 and #3). authorizeToolCall's own hasProjectAccess check
 * above this is a fail-fast duplicate of what createTask itself will also
 * enforce -- defense in depth, not the only gate.
 */
const projectsTaskCreate: ToolDefinition<
  import("zod").infer<typeof createTaskSchema>,
  { taskId: string }
> = {
  name: "projects.task.create",
  description: "Create a task on a project, optionally under a milestone, with a title/priority/due date/assignee.",
  domain: "projects",
  requiredPermission: PERMISSIONS.PROJECTS_UPDATE,
  scopeType: "project",
  riskLevel: 1,
  inputSchema: createTaskSchema,
  async handler(input) {
    return createTask(input);
  },
};

export const projectsTools = {
  [projectsSearch.name]: projectsSearch,
  [projectsTaskCreate.name]: projectsTaskCreate,
};
