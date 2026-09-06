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
 *
 * The write goes through the service-role client, not the RLS-bound one --
 * agent_sessions only carries a SELECT policy (migration 0033, mirroring
 * ai_action_requests), so a normal client insert always failed RLS and
 * surfaced as "Something went wrong." The permission check above is what
 * actually gates this, same as every other server-role write in this file.
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
    if (!agent.enabled || agent.mode === "OFF") return { ok: false, error: "That agent is currently disabled." };
    // Agents are org-wide (companyId null) or scoped to one specific
    // company -- only today's single seeded agent is org-wide, so this is
    // a no-op today, but the next company-scoped agent must not be
    // reachable through a session created for a different company.
    if (agent.organisationId !== parsed.organisationId) {
      return { ok: false, error: "That agent does not exist." };
    }
    if (agent.companyId !== null && agent.companyId !== parsed.companyId) {
      return { ok: false, error: "That agent isn't available for this company." };
    }

    const service = createServiceRoleClient();
    const { data, error } = await service
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

    await writeAuditLog({
      actorUserId: user.id,
      organisationId: parsed.organisationId,
      companyId: parsed.companyId,
      resourceType: "agent_sessions",
      resourceId: data.id,
      action: "session.created",
      afterState: { title: parsed.title, agentKey: parsed.agentKey },
    });

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

/**
 * "Can see this session" (agent_sessions_select's RLS policy, migration
 * 0033) is deliberately broad -- anyone holding agents.read for the company
 * can see conversation history for oversight, including a Viewer. That is
 * NOT the same right as mutating or posting into someone else's
 * conversation. Every write below (rename/archive/sendMessage/attach) must
 * pass this check in addition to a successful getSession() read -- read
 * visibility is never treated as write authorization.
 */
export async function canMutateSession(session: { created_by: string; company_id: string | null; organisation_id: string }, userId: string): Promise<boolean> {
  if (session.created_by === userId) return true;
  return session.company_id
    ? hasPermission(session.company_id, PERMISSIONS.AGENTS_MANAGE)
    : hasOrgPermission(session.organisation_id, PERMISSIONS.AGENTS_MANAGE);
}

const renameSchema = z.object({ sessionId: z.string().uuid(), title: z.string().min(1).max(200) });

export async function renameSession(input: unknown): Promise<ActionResult<object>> {
  try {
    const parsed = renameSchema.parse(input);
    const user = await requireCurrentUser();

    // RLS-gated read confirms the caller can see this session; a separate
    // check confirms they may actually rename it (see canMutateSession).
    const existing = await getSession(parsed.sessionId);
    if (!existing) return { ok: false, error: "Session not found." };
    if (!(await canMutateSession(existing, user.id))) {
      return { ok: false, error: "You don't have permission to modify this conversation." };
    }

    const service = createServiceRoleClient();
    const { error } = await service
      .from("agent_sessions")
      .update({ title: parsed.title, updated_at: new Date().toISOString() })
      .eq("id", parsed.sessionId);
    if (error) return { ok: false, error: "Something went wrong. Please try again." };

    await writeAuditLog({
      actorUserId: user.id,
      organisationId: existing.organisation_id,
      companyId: existing.company_id,
      resourceType: "agent_sessions",
      resourceId: parsed.sessionId,
      action: "session.renamed",
      afterState: { title: parsed.title },
    });

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

    // Was previously looked up via the service-role client with no
    // authorization check at all -- any authenticated user who knew a
    // session id could archive any session in the system, cross-company
    // included. Fixed: RLS-gated read + explicit mutate check, same as
    // renameSession, before the service-role client performs the write.
    const session = await getSession(parsed.sessionId);
    if (!session) return { ok: false, error: "Session not found." };
    if (!(await canMutateSession(session, user.id))) {
      return { ok: false, error: "You don't have permission to modify this conversation." };
    }

    const service = createServiceRoleClient();
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
