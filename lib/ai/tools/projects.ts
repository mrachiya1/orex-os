import { createServerSupabaseClient } from "@/lib/database/server";
import { PERMISSIONS } from "@/lib/permissions";
import { createTask, createTasksBatch } from "@/app/actions/project-tasks";
import { createTaskSchema, createTasksBatchSchema } from "@/lib/validation/projects";
import { checkProjectReadiness } from "@/lib/projects/readiness";
import { urgencyBadge, urgencyBucket } from "@/lib/projects/urgency";
import { projectsSearchInputSchema, projectsGetInputSchema, projectsListAtRiskInputSchema } from "./schemas";
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

export interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  priority: string;
  healthState: string;
  targetDate: string | null;
  openTasks: Array<{ id: string; title: string; status: string; priority: string; dueDate: string | null }>;
  milestones: Array<{ id: string; title: string; status: string; isBlocking: boolean }>;
  deliverables: Array<{ id: string; title: string; approvalState: string; isRequired: boolean }>;
  readiness: { ready: boolean; missingCount: number };
}

/**
 * LEVEL 0 (read only). Full project detail for real "what's going on with
 * X" questions -- everything here is an existing query already used by the
 * project detail page, just assembled server-side instead of client-side.
 * checkProjectReadiness is the same function markDeliveryReady() itself
 * uses, never a reimplementation.
 */
const projectsGet: ToolDefinition<{ projectId: string }, ProjectDetail> = {
  name: "projects.get",
  description: "Get full detail for one project: status, open tasks, milestones, deliverables, delivery readiness.",
  domain: "projects",
  requiredPermission: PERMISSIONS.PROJECTS_READ,
  scopeType: "project",
  riskLevel: 0,
  inputSchema: projectsGetInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const [projectRes, tasksRes, milestonesRes, deliverablesRes, readiness] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, status, priority, health_state, target_date")
        .eq("id", input.projectId)
        .maybeSingle(),
      supabase
        .from("project_tasks")
        .select("id, title, status, priority, due_date")
        .eq("project_id", input.projectId)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(30),
      supabase
        .from("project_milestones")
        .select("id, title, status, is_blocking")
        .eq("project_id", input.projectId)
        .neq("status", "completed"),
      supabase
        .from("project_deliverables")
        .select("id, title, approval_state, is_required")
        .eq("project_id", input.projectId)
        .neq("approval_state", "approved"),
      checkProjectReadiness(supabase, input.projectId),
    ]);
    if (projectRes.error) throw new Error(projectRes.error.message);
    if (!projectRes.data) throw new Error("Project not found");
    if (tasksRes.error) throw new Error(tasksRes.error.message);
    if (milestonesRes.error) throw new Error(milestonesRes.error.message);
    if (deliverablesRes.error) throw new Error(deliverablesRes.error.message);

    const p = projectRes.data;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      healthState: p.health_state,
      targetDate: p.target_date,
      openTasks: (tasksRes.data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
      })),
      milestones: (milestonesRes.data ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        isBlocking: m.is_blocking,
      })),
      deliverables: (deliverablesRes.data ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        approvalState: d.approval_state,
        isRequired: d.is_required,
      })),
      readiness: { ready: readiness.ready, missingCount: readiness.missing.length },
    };
  },
};

export interface AtRiskProject {
  id: string;
  name: string;
  status: string;
  priority: string;
  healthState: string;
  targetDate: string | null;
  urgencyBadge: string | null;
}

/**
 * LEVEL 0 (read only). "What needs attention" across a company -- reuses
 * the exact urgency ordering the Projects page itself uses
 * (lib/projects/urgency.ts), never a second ranking heuristic invented for
 * AI. Scoped to the caller's own company via the normal client, same as
 * projects.search.
 */
const projectsListAtRisk: ToolDefinition<{ companyId: string; limit?: number }, AtRiskProject[]> = {
  name: "projects.list_at_risk",
  description: "List this company's projects most needing attention (overdue, blocked, due soon, high priority), most urgent first.",
  domain: "projects",
  requiredPermission: PERMISSIONS.PROJECTS_READ,
  scopeType: "company",
  riskLevel: 0,
  inputSchema: projectsListAtRiskInputSchema,
  async handler(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status, priority, health_state, target_date")
      .eq("company_id", input.companyId)
      .not("status", "in", "(completed,archived,cancelled,delivered)");
    if (error) throw new Error(error.message);

    const ranked = (data ?? [])
      .map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        healthState: p.health_state,
        targetDate: p.target_date,
        urgencyBadge: urgencyBadge({
          status: p.status,
          priority: p.priority,
          targetDate: p.target_date,
          healthState: p.health_state,
        }),
        _bucket: urgencyBucket({
          status: p.status,
          priority: p.priority,
          targetDate: p.target_date,
          healthState: p.health_state,
        }),
      }))
      .sort((a, b) => a._bucket - b._bucket)
      .slice(0, input.limit ?? 10)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _bucket, ...rest }) => rest);

    return ranked;
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
  [projectsGet.name]: projectsGet,
  [projectsListAtRisk.name]: projectsListAtRisk,
  [projectsTaskCreate.name]: projectsTaskCreate,
  [projectsTasksCreateBatch.name]: projectsTasksCreateBatch,
};
