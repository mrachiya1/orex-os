import { createServerSupabaseClient } from "@/lib/database/server";
import { PERMISSIONS } from "@/lib/permissions";
import { createTask, createTasksBatch } from "@/app/actions/project-tasks";
import { createTaskSchema, createTasksBatchSchema } from "@/lib/validation/projects";
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

/**
 * LEVEL 1 (safe update). Same trust model as projectsTaskCreate -- the
 * handler is the real createTasksBatch action verbatim, never a
 * reimplementation. Same risk level as a single task create: creating N
 * pre-approved tasks the founder has already reviewed in the proposal card
 * is not riskier per-item than creating one, and the batch size itself is
 * hard-capped in the input schema (MAX_BATCH_TASK_COUNT), not here.
 */
const projectsTasksCreateBatch: ToolDefinition<
  import("zod").infer<typeof createTasksBatchSchema>,
  { taskIds: string[]; count: number }
> = {
  name: "projects.tasks.create_batch",
  description:
    "Create multiple tasks on a project in one operation (checklist/batch import), up to 50 tasks per batch.",
  domain: "projects",
  requiredPermission: PERMISSIONS.PROJECTS_UPDATE,
  scopeType: "project",
  riskLevel: 1,
  inputSchema: createTasksBatchSchema,
  async handler(input) {
    return createTasksBatch(input);
  },
};

export const projectsTools = {
  [projectsSearch.name]: projectsSearch,
  [projectsTaskCreate.name]: projectsTaskCreate,
  [projectsTasksCreateBatch.name]: projectsTasksCreateBatch,
};
