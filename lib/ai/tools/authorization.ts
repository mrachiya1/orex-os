import { hasPermission, hasOrgPermission, hasProjectAccess } from "@/lib/permissions";
import type { AnyToolDefinition } from "./types";

export class ToolAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolAuthorizationError";
  }
}

/**
 * Resolves the correct permission check for a tool's scopeType. For
 * "project", this derives authorization from the project row itself via
 * hasProjectAccess's own RPC (which resolves the project's company/org
 * server-side) -- never from a client-supplied companyId/organisationId,
 * mirroring getProjectScope in app/actions/project-tasks.ts. Throws
 * ToolAuthorizationError (never a generic Error) so the executor can
 * recognize this specific failure class without string-matching.
 */
export async function authorizeToolCall(
  tool: AnyToolDefinition,
  input: Record<string, unknown>
): Promise<void> {
  if (tool.scopeType === "project") {
    const projectId = input.projectId;
    if (typeof projectId !== "string") {
      throw new ToolAuthorizationError(`Tool "${tool.name}" is project-scoped but no projectId was provided.`);
    }
    const allowed = await hasProjectAccess(projectId, tool.requiredPermission);
    if (!allowed) throw new ToolAuthorizationError("You don't have permission to do that on this project.");
    return;
  }

  if (tool.scopeType === "company") {
    const companyId = input.companyId;
    if (typeof companyId !== "string") {
      throw new ToolAuthorizationError(`Tool "${tool.name}" is company-scoped but no companyId was provided.`);
    }
    const allowed = await hasPermission(companyId, tool.requiredPermission);
    if (!allowed) throw new ToolAuthorizationError("You don't have permission to do that in this company.");
    return;
  }

  // organisation
  const organisationId = input.organisationId;
  if (typeof organisationId !== "string") {
    throw new ToolAuthorizationError(`Tool "${tool.name}" is organisation-scoped but no organisationId was provided.`);
  }
  const allowed = await hasOrgPermission(organisationId, tool.requiredPermission);
  if (!allowed) throw new ToolAuthorizationError("You don't have permission to do that.");
}
