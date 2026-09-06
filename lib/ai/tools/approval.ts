import "server-only";
import { createServiceRoleClient } from "@/lib/database/server";
import { writeAuditLog } from "@/lib/audit";
import type { RiskLevel } from "./types";

/**
 * Low-level ai_action_requests row operations. Every write goes through the
 * service-role client (this table has no client-facing INSERT/UPDATE
 * policy -- see the 0032 migration), after the caller has already done its
 * own permission check; this file never authorizes anything itself.
 */

export interface ActionRequestRow {
  id: string;
  organisation_id: string;
  company_id: string | null;
  project_id: string | null;
  agent_id: string;
  actor_user_id: string;
  tool_name: string;
  risk_level: RiskLevel;
  status: "proposed" | "approved" | "rejected" | "executed" | "failed";
  input: unknown;
  result: unknown;
  reason: string | null;
  decided_by: string | null;
}

export async function insertActionRequest(params: {
  organisationId: string;
  companyId: string | null;
  projectId: string | null;
  agentId: string;
  actorUserId: string;
  toolName: string;
  riskLevel: RiskLevel;
  input: unknown;
  status: "proposed" | "executed" | "failed";
  result?: unknown;
  errorMessage?: string;
}): Promise<string> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("ai_action_requests")
    .insert({
      organisation_id: params.organisationId,
      company_id: params.companyId,
      project_id: params.projectId,
      agent_id: params.agentId,
      actor_user_id: params.actorUserId,
      tool_name: params.toolName,
      risk_level: params.riskLevel,
      status: params.status,
      input: params.input,
      result: params.result ?? null,
      error_message: params.errorMessage ?? null,
      executed_at: params.status === "executed" || params.status === "failed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: params.actorUserId,
    actorType: "ai_agent",
    organisationId: params.organisationId,
    companyId: params.companyId,
    resourceType: "ai_action_requests",
    resourceId: data.id,
    action: `ai_action.${params.status}`,
    requestMetadata: { agentId: params.agentId, toolName: params.toolName, riskLevel: params.riskLevel },
    resultStatus: params.status === "failed" ? "failure" : "success",
    errorDetails: params.errorMessage ?? null,
  });

  return data.id;
}

export async function getActionRequest(id: string): Promise<ActionRequestRow | null> {
  const service = createServiceRoleClient();
  const { data, error } = await service.from("ai_action_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ActionRequestRow | null;
}

/**
 * Transitions a `proposed` row to executed/failed/rejected, recording who
 * decided it and when. Returns false (does nothing) if the row is not
 * currently `proposed` -- this is the idempotency guard: a second approval
 * attempt on an already-decided request is a clean no-op, never a second
 * execution.
 */
export async function decideActionRequest(
  id: string,
  decidedBy: string,
  outcome: "rejected" | "executed" | "failed",
  extra?: { result?: unknown; errorMessage?: string }
): Promise<boolean> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("ai_action_requests")
    .update({
      status: outcome,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      executed_at: outcome !== "rejected" ? new Date().toISOString() : null,
      result: extra?.result ?? null,
      error_message: extra?.errorMessage ?? null,
    })
    .eq("id", id)
    .eq("status", "proposed")
    .select("id, organisation_id, company_id, agent_id, tool_name, risk_level")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;

  await writeAuditLog({
    actorUserId: decidedBy,
    actorType: "human",
    organisationId: data.organisation_id,
    companyId: data.company_id,
    resourceType: "ai_action_requests",
    resourceId: id,
    action: `ai_action.${outcome}`,
    requestMetadata: { agentId: data.agent_id, toolName: data.tool_name, riskLevel: data.risk_level },
    resultStatus: outcome === "failed" ? "failure" : "success",
    errorDetails: extra?.errorMessage ?? null,
  });

  return true;
}
