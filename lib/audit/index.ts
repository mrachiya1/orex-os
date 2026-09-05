import "server-only";
import { createServiceRoleClient } from "@/lib/database/server";
import { redactSecrets } from "./redaction";

export interface AuditEventInput {
  actorUserId: string | null;
  actorType?: "human" | "ai_agent" | "system" | "automation";
  organisationId?: string | null;
  companyId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  action: string;
  beforeState?: unknown;
  afterState?: unknown;
  reason?: string | null;
  approvalStatus?: string | null;
  approvalUserId?: string | null;
  requestMetadata?: Record<string, unknown> | null;
  resultStatus?: "success" | "failure";
  errorDetails?: string | null;
}

// Redaction logic lives in ./redaction.ts (shared with lib/ai's context
// redaction, per prompts/002-openrouter-gateway.md) -- kept as a local alias
// so the rest of this file's call sites are unchanged.
const redact = redactSecrets;

/**
 * The single sanctioned way to write an audit record (see
 * .agents/skills/orex-audit-system/SKILL.md). Uses the service-role client
 * because audit_logs has no client-facing INSERT policy -- writes only ever
 * happen from server code, after the caller has already performed its own
 * permission check for the underlying mutation.
 */
export async function writeAuditLog(event: AuditEventInput): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: event.actorUserId,
    actor_type: event.actorType ?? "human",
    organisation_id: event.organisationId ?? null,
    company_id: event.companyId ?? null,
    resource_type: event.resourceType,
    resource_id: event.resourceId ?? null,
    action: event.action,
    before_state: redact(event.beforeState ?? null),
    after_state: redact(event.afterState ?? null),
    reason: event.reason ?? null,
    approval_status: event.approvalStatus ?? null,
    approval_user_id: event.approvalUserId ?? null,
    request_metadata: redact(event.requestMetadata ?? null),
    result_status: event.resultStatus ?? "success",
    error_details: event.errorDetails ? redact(event.errorDetails) : null,
  });

  if (error) {
    // Audit-write failure must never silently vanish, but must also never
    // block the caller's already-completed mutation from returning.
    console.error("Failed to write audit log", {
      resourceType: event.resourceType,
      action: event.action,
      message: error.message,
    });
  }
}
