import { z } from "zod";

/**
 * Tool-specific input schemas that have no existing equivalent in
 * lib/validation/*.ts. Tools that wrap an existing human-facing action
 * (e.g. projects.task.create) import that action's own schema directly
 * instead of duplicating it here -- see lib/ai/tools/projects.ts.
 */
export const projectsSearchInputSchema = z.object({
  companyId: z.string().uuid(),
  query: z.string().min(1).max(200),
});

export type ProjectsSearchInput = z.infer<typeof projectsSearchInputSchema>;

export const projectsGetInputSchema = z.object({
  projectId: z.string().uuid(),
});
export type ProjectsGetInput = z.infer<typeof projectsGetInputSchema>;

export const projectsListAtRiskInputSchema = z.object({
  companyId: z.string().uuid(),
  limit: z.number().int().min(1).max(20).default(10),
});
export type ProjectsListAtRiskInput = z.infer<typeof projectsListAtRiskInputSchema>;
