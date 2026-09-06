"use server";

import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/database/server";
import { getSession, canMutateSession } from "./sessions";
import { runCompanyBrainCommand, type CompanyBrainCommandResult } from "./agent-actions";
import { getToolRiskLabel } from "@/lib/ai/tools/registry";
import { toSafeAIErrorMessage } from "@/lib/ai/errors";
import type { ActionResult } from "@/lib/actions/result";

const sendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

/**
 * Persists the user's message, invokes the session's agent, and persists
 * the assistant's response -- reuses the existing, already-tested
 * runCompanyBrainCommand orchestration verbatim (the only agent that
 * exists today, "advisor", is exactly what that function already drives)
 * rather than duplicating its permission/retrieval/tool-resolution logic.
 * A session is purely a persistence wrapper around that same engine this
 * pass; once a second agent/the orchestrator exists, this is the one place
 * that needs to branch on session.primary_agent_id.
 */
export async function sendMessage(
  input: unknown
): Promise<ActionResult<{ assistant: CompanyBrainCommandResult; riskLabel: string | null }>> {
  try {
    const parsed = sendMessageSchema.parse(input);
    const user = await requireCurrentUser();

    const session = await getSession(parsed.sessionId);
    if (!session) return { ok: false, error: "Session not found." };
    // agents.read visibility (broad, for oversight) is not the same right
    // as posting into someone else's conversation -- only the creator (or
    // agents.manage) may send a message into this session.
    if (!(await canMutateSession(session, user.id))) {
      return { ok: false, error: "You don't have permission to post to this conversation." };
    }

    const service = createServiceRoleClient();
    const now = new Date().toISOString();

    await service.from("agent_messages").insert({
      session_id: session.id,
      role: "user",
      content: parsed.content,
      created_by: user.id,
    });
    await service.from("agent_sessions").update({ last_message_at: now, updated_at: now }).eq("id", session.id);

    const result = await runCompanyBrainCommand({
      organisationId: session.organisation_id,
      companyId: session.company_id,
      question: parsed.content,
    });

    // Real, registered risk level for the proposed tool (prompts/013 LEVEL
    // 0-3) -- never a per-request guess. Only action_proposed/action_executed
    // carry a toolName.
    const riskLabel =
      result.ok && (result.kind === "action_proposed" || result.kind === "action_executed")
        ? getToolRiskLabel(result.toolName)
        : null;

    const assistantContent = result.ok ? summarizeResult(result) : result.error;
    await service.from("agent_messages").insert({
      session_id: session.id,
      role: "assistant",
      content: assistantContent,
      metadata: result.ok ? { kind: result.kind, riskLabel } : { error: true },
    });
    await service.from("agent_sessions").update({ last_message_at: new Date().toISOString() }).eq("id", session.id);

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, assistant: result, riskLabel };
  } catch (err) {
    console.error("sendMessage failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

function summarizeResult(result: { ok: true } & CompanyBrainCommandResult): string {
  if (result.kind === "answer") return result.answer;
  if (result.kind === "needs_clarification") return result.question;
  if (result.kind === "action_proposed") return `Proposed: ${result.summary}`;
  return `Done: ${result.summary}`;
}

export async function listMessages(sessionId: string) {
  await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("agent_messages")
    .select("id, role, content, metadata, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
