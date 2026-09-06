"use server";

import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { hasPermission, hasOrgPermission, hasProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/database/server";
import { getSession } from "./sessions";
import { toSafeAIErrorMessage } from "@/lib/ai/errors";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Tier A only (prompts/014-orex-intelligence.md Decisions #7): reference-
 * type attachments point at an existing record by id and inherit that
 * record's OWN permission/classification rules -- never a separate,
 * weaker check invented for chat. Real binary file/image/voice upload is
 * deferred to its own follow-up.
 */
const attachReferenceSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  attachmentType: z.enum(["project_ref", "knowledge_ref", "decision_ref", "session_ref"]),
  referenceId: z.string().uuid(),
});

async function verifyReferenceAccess(
  attachmentType: "project_ref" | "knowledge_ref" | "decision_ref" | "session_ref",
  referenceId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  if (attachmentType === "project_ref") {
    return hasProjectAccess(referenceId, PERMISSIONS.PROJECTS_READ);
  }

  if (attachmentType === "session_ref") {
    // RLS-gated read: a session the caller cannot see returns no row.
    const referenced = await getSession(referenceId);
    return referenced !== null;
  }

  if (attachmentType === "knowledge_ref") {
    const { data, error } = await supabase
      .from("knowledge_items")
      .select("organisation_id, company_id, classification")
      .eq("id", referenceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return false;
    // Secret-classified content must never enter an AI-accessible chat
    // context, regardless of the caller's own permission -- fails closed.
    if (data.classification === "secret") return false;
    return data.company_id
      ? hasPermission(data.company_id, PERMISSIONS.KNOWLEDGE_READ)
      : hasOrgPermission(data.organisation_id, PERMISSIONS.KNOWLEDGE_READ);
  }

  // decision_ref
  const { data, error } = await supabase
    .from("decisions")
    .select("organisation_id, company_id")
    .eq("id", referenceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  return data.company_id
    ? hasPermission(data.company_id, PERMISSIONS.DECISIONS_READ)
    : hasOrgPermission(data.organisation_id, PERMISSIONS.DECISIONS_READ);
}

export async function attachReference(input: unknown): Promise<ActionResult<{ attachmentId: string }>> {
  try {
    const parsed = attachReferenceSchema.parse(input);
    const user = await requireCurrentUser();

    const session = await getSession(parsed.sessionId);
    if (!session) return { ok: false, error: "Session not found." };

    const allowed = await verifyReferenceAccess(parsed.attachmentType, parsed.referenceId);
    if (!allowed) return { ok: false, error: "You don't have permission to attach that." };

    const service = createServiceRoleClient();
    const { data, error } = await service
      .from("agent_attachments")
      .insert({
        session_id: session.id,
        message_id: parsed.messageId ?? null,
        organisation_id: session.organisation_id,
        company_id: session.company_id,
        actor_user_id: user.id,
        attachment_type: parsed.attachmentType,
        reference_id: parsed.referenceId,
        status: "ready",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: "Something went wrong. Please try again." };

    return { ok: true, attachmentId: data.id };
  } catch (err) {
    console.error("attachReference failed", err);
    return { ok: false, error: toSafeAIErrorMessage(err) };
  }
}

export async function listAttachments(sessionId: string) {
  await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("agent_attachments")
    .select("id, message_id, attachment_type, reference_id, status, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
