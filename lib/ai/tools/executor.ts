import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission, hasOrgPermission, hasProjectAccess } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/database/server";
import { toSafeAIErrorMessage } from "@/lib/ai/errors";
import { getAgent } from "@/lib/ai/agents/registry";
import { checkBudgetRemaining } from "@/lib/ai/agents/budgets";
import { getGlobalAIControls } from "@/lib/ai/agents/global-controls";
import { getTool } from "./registry";
import { authorizeToolCall, ToolAuthorizationError } from "./authorization";
import { isExecutionAllowed } from "./risk";
import { insertActionRequest, decideActionRequest, getActionRequest } from "./approval";
import type { ActionResult } from "@/lib/actions/result";

export type ExecuteToolResult =
  | { status: "executed"; output: unknown; requestId: string }
  | { status: "pending_approval"; requestId: string };

async function resolveScopeIds(
  scopeType: "organisation" | "company" | "project",
  input: Record<string, unknown>
): Promise<{ organisationId: string; companyId: string | null; projectId: string | null }> {
  const supabase = await createServerSupabaseClient();

  if (scopeType === "project") {
    const projectId = input.projectId as string;
    const { data, error } = await supabase
      .from("projects")
      .select("organisation_id, company_id")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Project not found");
    return { organisationId: data.organisation_id, companyId: data.company_id, projectId };
  }

  if (scopeType === "company") {
    const companyId = input.companyId as string;
    const { data, error } = await supabase.from("companies").select("organisation_id").eq("id", companyId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Company not found");
    return { organisationId: data.organisation_id, companyId, projectId: null };
  }

  return { organisationId: input.organisationId as string, companyId: null, projectId: null };
}

/**
 * The single entrypoint every feature (Company Brain, future Advisor/
 * Agents pages) must call to run an AI tool -- never call a tool's handler
 * directly. Never lets a thrown error escape; always returns ActionResult
 * (prompts/013-ai-action-engine.md).
 */
export async function executeTool(
  toolName: string,
  rawInput: unknown,
  agentId: string
): Promise<ActionResult<ExecuteToolResult>> {
  try {
    const tool = getTool(toolName);
    if (!tool) return { ok: false, error: "Unknown tool." };

    const agent = await getAgent(agentId);
    if (!agent) return { ok: false, error: "Unknown agent." };
    // A disabled agent (or one whose mode is OFF) cannot run manually,
    // on a schedule, from an event, or from the orchestrator -- there is
    // no code path that skips this check (prompts/014-orex-intelligence.md
    // "DISABLED AGENT SECURITY"). Re-enabling restores normal operation
    // immediately; disabling never touches history, only future runs.
    if (!agent.enabled || agent.mode === "OFF") {
      return { ok: false, error: "This agent is disabled." };
    }
    // Schedules/events aren't implemented yet -- every call into executeTool
    // today is a manual (chat) invocation, so a SCHEDULED-mode agent has no
    // valid caller yet and must fail closed rather than silently running.
    if (agent.mode === "SCHEDULED") {
      return { ok: false, error: "This agent only runs on its configured schedule." };
    }
    if (!agent.allowedTools.includes(toolName)) {
      return { ok: false, error: "This agent is not allowed to use that tool." };
    }
    if (tool.riskLevel > agent.maxRiskLevel) {
      return { ok: false, error: "This action exceeds what this agent is allowed to do." };
    }

    const parsed = tool.inputSchema.safeParse(rawInput);
    if (!parsed.success) return { ok: false, error: "Invalid input for that tool." };
    const input = parsed.data as Record<string, unknown>;

    const user = await requireCurrentUser();

    await authorizeToolCall(tool, input);

    const scope = await resolveScopeIds(tool.scopeType, input);

    if (scope.companyId) {
      const controls = await getGlobalAIControls(scope.companyId);
      if (controls.paused) return { ok: false, error: "AI is currently paused for this company." };
    }

    const budgetCheck = await checkBudgetRemaining(agent.id);
    if (!budgetCheck.ok) return { ok: false, error: budgetCheck.reason };

    const decision = isExecutionAllowed(agent.autonomyMode, tool.riskLevel);
    if (decision === "refuse") {
      return { ok: false, error: "This agent is read-only and cannot perform that action." };
    }

    if (decision === "propose") {
      const requestId = await insertActionRequest({
        organisationId: scope.organisationId,
        companyId: scope.companyId,
        projectId: scope.projectId,
        agentId,
        actorUserId: user.id,
        toolName,
        riskLevel: tool.riskLevel,
        input,
        status: "proposed",
      });
      return { ok: true, status: "pending_approval", requestId };
    }

    // decision === "execute"
    try {
      const output = await tool.handler(input as never, { userId: user.id, agentId });
      const requestId = await insertActionRequest({
        organisationId: scope.organisationId,
        companyId: scope.companyId,
        projectId: scope.projectId,
        agentId,
        actorUserId: user.id,
        toolName,
        riskLevel: tool.riskLevel,
        input,
        status: "executed",
        result: output,
      });
      return { ok: true, status: "executed", output, requestId };
    } catch (handlerErr) {
      const message = toSafeAIErrorMessage(handlerErr);
      await insertActionRequest({
        organisationId: scope.organisationId,
        companyId: scope.companyId,
        projectId: scope.projectId,
        agentId,
        actorUserId: user.id,
        toolName,
        riskLevel: tool.riskLevel,
        input,
        status: "failed",
        errorMessage: message,
      });
      return { ok: false, error: message };
    }
  } catch (err) {
    if (err instanceof ToolAuthorizationError) return { ok: false, error: err.message };
    console.error("executeTool failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

/**
 * The only way a `proposed` action ever gets executed -- a distinct,
 * human-invoked Server Action. There is no code path from executeTool (or
 * any AI-facing function) into this function; an agent can never approve
 * its own high-risk action. Re-checks the approver's OWN permission for
 * the tool's requiredPermission right now, independent of whatever
 * authorization the original proposal recorded.
 */
export async function approveActionRequest(
  requestId: string,
  outcome: "approved" | "rejected"
): Promise<ActionResult<{ status: string; output?: unknown }>> {
  try {
    const approver = await requireCurrentUser();
    const request = await getActionRequest(requestId);
    if (!request) return { ok: false, error: "Action request not found." };
    if (request.status !== "proposed") return { ok: false, error: "This action has already been decided." };

    const tool = getTool(request.tool_name);
    if (!tool) return { ok: false, error: "Unknown tool." };

    if (outcome === "approved") {
      const agent = await getAgent(request.agent_id);
      if (!agent || !agent.enabled || agent.mode === "OFF") {
        return { ok: false, error: "This agent has been disabled since this action was proposed." };
      }
    }

    if (outcome === "rejected") {
      const changed = await decideActionRequest(requestId, approver.id, "rejected");
      if (!changed) return { ok: false, error: "This action has already been decided." };
      return { ok: true, status: "rejected" };
    }

    const allowed =
      tool.scopeType === "project"
        ? await hasProjectAccess(request.project_id as string, tool.requiredPermission)
        : request.company_id
          ? await hasPermission(request.company_id, tool.requiredPermission)
          : await hasOrgPermission(request.organisation_id, tool.requiredPermission);
    if (!allowed) {
      return { ok: false, error: "You don't have permission to approve this action." };
    }

    try {
      const output = await tool.handler(request.input as never, { userId: approver.id, agentId: request.agent_id });
      const changed = await decideActionRequest(requestId, approver.id, "executed", { result: output });
      if (!changed) return { ok: false, error: "This action has already been decided." };
      return { ok: true, status: "executed", output };
    } catch (handlerErr) {
      const message = toSafeAIErrorMessage(handlerErr);
      await decideActionRequest(requestId, approver.id, "failed", { errorMessage: message });
      return { ok: false, error: message };
    }
  } catch (err) {
    console.error("approveActionRequest failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}
