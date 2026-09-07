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

/**
 * Clients Intelligence V1 (prompts/017) read-tool input schemas. All 7 are
 * risk 0 and are the only clients.* tools granted to the advisor agent
 * (migration 0045) -- no mutation tool exists for the AI in V1.
 */
export const clientsSearchInputSchema = z.object({
  companyId: z.string().uuid(),
  query: z.string().min(1).max(200),
});
export type ClientsSearchInput = z.infer<typeof clientsSearchInputSchema>;

export const clientsGetInputSchema = z.object({
  clientId: z.string().uuid(),
});
export type ClientsGetInput = z.infer<typeof clientsGetInputSchema>;

export const clientsListInputSchema = z.object({
  clientId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type ClientsListInput = z.infer<typeof clientsListInputSchema>;
