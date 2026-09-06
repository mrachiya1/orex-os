"use server";

import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission, hasOrgPermission, requirePermission, requireOrgPermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/database/server";
import { getAgent } from "@/lib/ai/agents/registry";
import { toSafeAIErrorMessage } from "@/lib/ai/errors";
import type { ActionResult } from "@/lib/actions/result";

const createSessionSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  goal: z.string().max(500).optional(),
  agentKey: z.string().min(1).default("advisor"),
});

/**
 * Every session requires an explicit agent this pass -- "Auto" (choosing
 * between multiple enabled agents) is the Super Brain Orchestrator, which
 * is explicitly deferred (prompts/014-orex-intelligence.md Decisions #5).
 * A UI "Auto" option should just pass "advisor" here for now.
 */
export async function createSession(input: unknown): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const parsed = createSessionSchema.parse(input);
    const user = await requireCurrentUser();

    const allowed = parsed.companyId
      ? await hasPermission(parsed.companyId, PERMISSIONS.AGENTS_USE)
      : await hasOrgPermission(parsed.organisationId, PERMISSIONS.AGENTS_USE);
    if (!allowed) return { ok: false, error: "You don't have permission to use AI agents in this company." };

    const agent = await getAgent(parsed.agentKey);
    if (!agent) return { ok: false, error: "That agent does not exist." };

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("agent_sessions")
      .insert({
        organisation_id: parsed.organisationId,
        company_id: parsed.companyId,
        created_by: user.id,
        title: parsed.title,
        goal: parsed.goal ?? null,
        primary_agent_id: agent.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: "Something went wrong. Please try again." };

    return { ok: true, sessionId: data.id };
  } catch (err) {
    console.error("createSession failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

export async function listSessions(companyId: string | null, organisationId: string) {
  await requireCurrentUser();
  if (companyId) {
    await requirePermission(companyId, PERMISSIONS.AGENTS_USE);
  } else {
    await requireOrgPermission(organisationId, PERMISSIONS.AGENTS_USE);
  }

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("agent_sessions")
    .select("id, title, goal, status, primary_agent_id, created_at, updated_at, last_message_at")
    .order("last_message_at", { ascending: false });
  query = companyId ? query.eq("company_id", companyId) : query.is("company_id", null).eq("organisation_id", organisationId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSession(sessionId: string) {
  await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("agent_sessions")
    .select("id, organisation_id, company_id, title, goal, status, primary_agent_id, summary, created_by")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const renameSchema = z.object({ sessionId: z.string().uuid(), title: z.string().min(1).max(200) });

export async function renameSession(input: unknown): Promise<ActionResult<object>> {
  try {
    const parsed = renameSchema.parse(input);
    await requireCurrentUser();
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("agent_sessions")
      .update({ title: parsed.title, updated_at: new Date().toISOString() })
      .eq("id", parsed.sessionId);
    if (error) return { ok: false, error: "Something went wrong. Please try again." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

const archiveSchema = z.object({ sessionId: z.string().uuid(), archived: z.boolean() });

export async function archiveSession(input: unknown): Promise<ActionResult<object>> {
  try {
    const parsed = archiveSchema.parse(input);
    const user = await requireCurrentUser();
    const service = createServiceRoleClient();
    const { data: session, error: findError } = await service
      .from("agent_sessions")
      .select("id, organisation_id, company_id")
      .eq("id", parsed.sessionId)
      .maybeSingle();
    if (findError) return { ok: false, error: "Something went wrong. Please try again." };
    if (!session) return { ok: false, error: "Session not found." };

    const { error } = await service
      .from("agent_sessions")
      .update({ status: parsed.archived ? "archived" : "active", updated_at: new Date().toISOString() })
      .eq("id", parsed.sessionId);
    if (error) return { ok: false, error: "Something went wrong. Please try again." };

    await writeAuditLog({
      actorUserId: user.id,
      organisationId: session.organisation_id,
      companyId: session.company_id,
      resourceType: "agent_sessions",
      resourceId: parsed.sessionId,
      action: parsed.archived ? "session.archived" : "session.unarchived",
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}
