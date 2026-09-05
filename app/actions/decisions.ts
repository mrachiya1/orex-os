"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireScopedPermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/database/server";
import {
  createDecisionSchema,
  updateDecisionSchema,
  reviewDecisionSchema,
} from "@/lib/validation/decisions";

export async function createDecision(input: unknown) {
  const parsed = createDecisionSchema.parse(input);
  const user = await requireCurrentUser();
  await requireScopedPermission(parsed.companyId, parsed.organisationId, PERMISSIONS.DECISIONS_CREATE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("decisions")
    .insert({
      organisation_id: parsed.organisationId,
      company_id: parsed.companyId,
      title: parsed.title,
      owner_id: user.id,
      situation: parsed.situation,
      evidence: parsed.evidence,
      options: parsed.options,
      ai_recommendation: parsed.aiRecommendation ?? null,
      chosen_action: parsed.chosenAction ?? null,
      expected_result: parsed.expectedResult ?? null,
      decision_date: parsed.decisionDate ?? null,
      review_date: parsed.reviewDate ?? null,
      related_knowledge_item_id: parsed.relatedKnowledgeItemId ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: parsed.organisationId,
    companyId: parsed.companyId,
    resourceType: "decisions",
    resourceId: data.id,
    action: "decision.created",
    afterState: { title: parsed.title },
  });

  return { decisionId: data.id };
}

export async function updateDecision(input: unknown) {
  const parsed = updateDecisionSchema.parse(input);
  const user = await requireCurrentUser();

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("decisions")
    .select("id, organisation_id, company_id")
    .eq("id", parsed.decisionId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Decision not found");

  await requireScopedPermission(existing.company_id, existing.organisation_id, PERMISSIONS.DECISIONS_UPDATE);

  const { error } = await supabase
    .from("decisions")
    .update({
      status: parsed.status,
      chosen_action: parsed.chosenAction,
      expected_result: parsed.expectedResult,
      decision_date: parsed.decisionDate,
      review_date: parsed.reviewDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.decisionId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "decisions",
    resourceId: parsed.decisionId,
    action: "decision.updated",
    afterState: { status: parsed.status },
  });
}

/**
 * Appends a review -- never overwrites a prior review, so a decision's
 * review history accumulates over time (prompts/003-company-brain.md
 * section 15).
 */
export async function reviewDecision(input: unknown) {
  const parsed = reviewDecisionSchema.parse(input);
  const user = await requireCurrentUser();

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("decisions")
    .select("id, organisation_id, company_id")
    .eq("id", parsed.decisionId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Decision not found");

  await requireScopedPermission(existing.company_id, existing.organisation_id, PERMISSIONS.DECISIONS_REVIEW);

  const { data: review, error } = await supabase
    .from("decision_reviews")
    .insert({
      decision_id: parsed.decisionId,
      reviewed_by: user.id,
      actual_result: parsed.actualResult,
      lesson: parsed.lesson ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("decisions")
    .update({ status: "in_review", updated_at: new Date().toISOString() })
    .eq("id", parsed.decisionId);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "decisions",
    resourceId: parsed.decisionId,
    action: "decision.reviewed",
    afterState: { reviewId: review.id },
  });

  return { reviewId: review.id };
}
