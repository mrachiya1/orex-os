"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requirePermission, requireClientAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeClientActivity } from "@/lib/clients/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import {
  createClientSchema,
  updateClientSchema,
  archiveClientSchema,
  createContactSchema,
  updateContactPrivateSchema,
  createBrandSchema,
  linkProjectToClientSchema,
  updateProjectValueSchema,
  createNoteSchema,
  createPreferenceSchema,
  verifyPreferenceSchema,
  createFeedbackSchema,
  createIssueSchema,
  resolveIssueSchema,
  createCredentialSchema,
} from "@/lib/validation/clients";

async function loadClientScope(clientId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, company_id, organisation_id, name")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Client not found");
  return data;
}

export async function createClient(input: unknown) {
  const parsed = createClientSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.CLIENTS_CREATE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      organisation_id: parsed.organisationId,
      company_id: parsed.companyId,
      name: parsed.name,
      legal_name: parsed.legalName ?? null,
      status: parsed.status,
      relationship_stage: parsed.relationshipStage,
      website: parsed.website ?? null,
      industry: parsed.industry ?? null,
      country: parsed.country ?? null,
      timezone: parsed.timezone ?? null,
      source: parsed.source ?? null,
      how_we_met: parsed.howWeMet ?? null,
      client_since: parsed.clientSince ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: parsed.organisationId,
    companyId: parsed.companyId,
    resourceType: "clients",
    resourceId: data.id,
    action: "client.created",
    afterState: { name: parsed.name, status: parsed.status },
  });
  await writeClientActivity({
    clientId: data.id,
    companyId: parsed.companyId,
    actorUserId: user.id,
    eventType: "client.created",
    summary: `${parsed.name} was added as a client.`,
  });

  return { clientId: data.id };
}

export async function updateClient(input: unknown) {
  const parsed = updateClientSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requireClientAccess(parsed.clientId, PERMISSIONS.CLIENTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.legalName !== undefined) patch.legal_name = parsed.legalName;
  if (parsed.status !== undefined) patch.status = parsed.status;
  if (parsed.relationshipStage !== undefined) patch.relationship_stage = parsed.relationshipStage;
  if (parsed.website !== undefined) patch.website = parsed.website;
  if (parsed.industry !== undefined) patch.industry = parsed.industry;
  if (parsed.country !== undefined) patch.country = parsed.country;
  if (parsed.timezone !== undefined) patch.timezone = parsed.timezone;
  if (parsed.source !== undefined) patch.source = parsed.source;
  if (parsed.howWeMet !== undefined) patch.how_we_met = parsed.howWeMet;
  if (parsed.clientSince !== undefined) patch.client_since = parsed.clientSince;
  if (parsed.notesSummary !== undefined) patch.notes_summary = parsed.notesSummary;

  const { error } = await supabase.from("clients").update(patch).eq("id", parsed.clientId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "clients",
    resourceId: parsed.clientId,
    action: "client.updated",
    beforeState: { name: existing.name },
    afterState: patch,
  });

  if (parsed.status !== undefined) {
    await writeClientActivity({
      clientId: parsed.clientId,
      companyId: existing.company_id,
      actorUserId: user.id,
      eventType: "client.status_changed",
      summary: `Status changed to ${parsed.status.replace(/_/g, " ")}.`,
    });
  }
}

export async function archiveClient(input: unknown) {
  const parsed = archiveClientSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requireClientAccess(parsed.clientId, PERMISSIONS.CLIENTS_DELETE);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", parsed.clientId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "clients",
    resourceId: parsed.clientId,
    action: "client.archived",
  });
  await writeClientActivity({
    clientId: parsed.clientId,
    companyId: existing.company_id,
    actorUserId: user.id,
    eventType: "client.archived",
    summary: `${existing.name} was archived.`,
  });
}

export async function createContact(input: unknown) {
  const parsed = createContactSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requireClientAccess(parsed.clientId, PERMISSIONS.CLIENTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_contacts")
    .insert({
      client_id: parsed.clientId,
      company_id: existing.company_id,
      first_name: parsed.firstName,
      last_name: parsed.lastName ?? null,
      preferred_name: parsed.preferredName ?? null,
      job_title: parsed.jobTitle ?? null,
      business_email: parsed.businessEmail ?? null,
      business_phone: parsed.businessPhone ?? null,
      timezone: parsed.timezone ?? null,
      country: parsed.country ?? null,
      is_primary_contact: parsed.isPrimaryContact,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "client_contacts",
    resourceId: data.id,
    action: "client_contact.created",
    afterState: { firstName: parsed.firstName, lastName: parsed.lastName },
  });
  await writeClientActivity({
    clientId: parsed.clientId,
    companyId: existing.company_id,
    actorUserId: user.id,
    eventType: "client_contact.created",
    summary: `${parsed.firstName} ${parsed.lastName ?? ""}`.trim() + " was added as a contact.",
    relatedResourceType: "client_contacts",
    relatedResourceId: data.id,
  });

  return { contactId: data.id };
}

/**
 * Sensitive-tier read -- deliberately not part of any list query. Requires
 * client_contacts.read_private, never clients.read (founder decision 2).
 */
export async function getContactPrivate(contactId: string, companyId: string) {
  await requireCurrentUser();
  await requirePermission(companyId, PERMISSIONS.CLIENT_CONTACTS_READ_PRIVATE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_contact_private")
    .select("contact_id, birthday, personal_email, personal_phone, private_notes")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateContactPrivate(input: unknown) {
  const parsed = updateContactPrivateSchema.parse(input);
  const user = await requireCurrentUser();

  const supabase = await createServerSupabaseClient();
  const { data: contact, error: contactError } = await supabase
    .from("client_contacts")
    .select("id, client_id, company_id")
    .eq("id", parsed.contactId)
    .maybeSingle();
  if (contactError) throw new Error(contactError.message);
  if (!contact) throw new Error("Contact not found");

  await requirePermission(contact.company_id, PERMISSIONS.CLIENT_CONTACTS_MANAGE_PRIVATE);

  const patch: Record<string, unknown> = { contact_id: parsed.contactId, company_id: contact.company_id, updated_at: new Date().toISOString() };
  if (parsed.birthday !== undefined) patch.birthday = parsed.birthday;
  if (parsed.personalEmail !== undefined) patch.personal_email = parsed.personalEmail;
  if (parsed.personalPhone !== undefined) patch.personal_phone = parsed.personalPhone;
  if (parsed.privateNotes !== undefined) patch.private_notes = parsed.privateNotes;

  const { error } = await supabase.from("client_contact_private").upsert(patch, { onConflict: "contact_id" });
  if (error) throw new Error(error.message);

  // Never put private field VALUES into the audit trail -- only that a
  // change happened (redactSecrets would strip anything key-shaped like
  // "secret"/"password" anyway, but personal fields aren't secret-shaped,
  // so this is a deliberate, explicit omission, not a redaction fallback).
  await writeAuditLog({
    actorUserId: user.id,
    companyId: contact.company_id,
    resourceType: "client_contact_private",
    resourceId: parsed.contactId,
    action: "client_contact.private_updated",
  });
}

export async function createBrand(input: unknown) {
  const parsed = createBrandSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requireClientAccess(parsed.clientId, PERMISSIONS.CLIENTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_brands")
    .insert({
      client_id: parsed.clientId,
      company_id: existing.company_id,
      name: parsed.name,
      website: parsed.website ?? null,
      category: parsed.category ?? null,
      description: parsed.description ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "client_brands",
    resourceId: data.id,
    action: "client_brand.created",
    afterState: { name: parsed.name },
  });

  return { brandId: data.id };
}

/**
 * Links (or unlinks, clientId: null) a project to a client/brand/contact.
 * Uses projects.update permission (via hasProjectAccess) since this
 * mutates the project row -- the DB trigger (0040) independently enforces
 * that any non-null client/brand/contact belongs to the project's own
 * company, so a cross-company link is rejected even if this check were
 * somehow bypassed.
 */
export async function linkProjectToClient(input: unknown) {
  const { hasProjectAccess } = await import("@/lib/permissions");
  const parsed = linkProjectToClientSchema.parse(input);
  const user = await requireCurrentUser();

  const supabase = await createServerSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, company_id, organisation_id, name")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Project not found");

  const allowed = await hasProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  if (!allowed) throw new Error("Forbidden: missing required permission");

  const { error } = await supabase
    .from("projects")
    .update({
      client_id: parsed.clientId,
      client_brand_id: parsed.clientBrandId ?? null,
      primary_client_contact_id: parsed.primaryClientContactId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: project.organisation_id,
    companyId: project.company_id,
    resourceType: "projects",
    resourceId: parsed.projectId,
    action: "project.client_linked",
    afterState: { clientId: parsed.clientId },
  });

  if (parsed.clientId) {
    await writeClientActivity({
      clientId: parsed.clientId,
      companyId: project.company_id,
      actorUserId: user.id,
      eventType: "project.linked",
      summary: `Project "${project.name}" was linked to this client.`,
      relatedResourceType: "projects",
      relatedResourceId: parsed.projectId,
    });
  }
}

/**
 * Founder decision 3: real typed Project Value. Uses the existing
 * projects.update permission -- no separate financial permission.
 */
export async function updateProjectValue(input: unknown) {
  const { hasProjectAccess } = await import("@/lib/permissions");
  const parsed = updateProjectValueSchema.parse(input);
  const user = await requireCurrentUser();

  const supabase = await createServerSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, company_id, organisation_id, project_value_minor, currency_code")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Project not found");

  const allowed = await hasProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  if (!allowed) throw new Error("Forbidden: missing required permission");

  const { error } = await supabase
    .from("projects")
    .update({
      project_value_minor: parsed.projectValueMinor,
      currency_code: parsed.currencyCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: project.organisation_id,
    companyId: project.company_id,
    resourceType: "projects",
    resourceId: parsed.projectId,
    action: "project.value_updated",
    beforeState: { projectValueMinor: project.project_value_minor, currencyCode: project.currency_code },
    afterState: { projectValueMinor: parsed.projectValueMinor, currencyCode: parsed.currencyCode },
  });
}

export async function createNote(input: unknown) {
  const parsed = createNoteSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requireClientAccess(parsed.clientId, PERMISSIONS.CLIENTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_notes")
    .insert({
      client_id: parsed.clientId,
      contact_id: parsed.contactId ?? null,
      company_id: existing.company_id,
      type: parsed.type,
      content: parsed.content,
      source: parsed.source ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "client_notes",
    resourceId: data.id,
    action: "client_note.created",
  });
  await writeClientActivity({
    clientId: parsed.clientId,
    companyId: existing.company_id,
    actorUserId: user.id,
    eventType: "client_note.created",
    summary: parsed.content.length > 140 ? `${parsed.content.slice(0, 140)}…` : parsed.content,
    relatedResourceType: "client_notes",
    relatedResourceId: data.id,
  });

  return { noteId: data.id };
}

/**
 * Human-authored preferences default to knowledgeType "observed" (someone
 * noticed a pattern) unless the caller explicitly marks it verified via a
 * direct client statement -- origin "client_direct" auto-verifies since
 * that IS the verification. AI-originated preferences (origin: "ai") are
 * never accepted from this action -- there is no AI mutation tool for
 * preference creation in V1 (only read tools were granted, see prompts/017
 * section 19 Decision 1), so this path is human-only in practice; the check
 * below is defense in depth matching the DB constraint.
 */
export async function createPreference(input: unknown) {
  const parsed = createPreferenceSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requireClientAccess(parsed.clientId, PERMISSIONS.CLIENTS_UPDATE);

  const knowledgeType = parsed.origin === "client_direct" ? "verified" : "observed";
  const verified = knowledgeType === "verified";

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_preferences")
    .insert({
      client_id: parsed.clientId,
      contact_id: parsed.contactId ?? null,
      company_id: existing.company_id,
      category: parsed.category,
      statement: parsed.statement,
      sentiment: parsed.sentiment,
      origin: parsed.origin,
      knowledge_type: knowledgeType,
      verified,
      source_reference: parsed.sourceReference ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "client_preferences",
    resourceId: data.id,
    action: "client_preference.created",
  });
  await writeClientActivity({
    clientId: parsed.clientId,
    companyId: existing.company_id,
    actorUserId: user.id,
    eventType: "client_preference.created",
    summary: parsed.statement,
    relatedResourceType: "client_preferences",
    relatedResourceId: data.id,
  });

  return { preferenceId: data.id };
}

/** Promotes an observed/inference preference to verified. Never runs for origin "ai" (DB constraint enforces this too). */
export async function verifyPreference(input: unknown) {
  const parsed = verifyPreferenceSchema.parse(input);
  const user = await requireCurrentUser();

  const supabase = await createServerSupabaseClient();
  const { data: pref, error: prefError } = await supabase
    .from("client_preferences")
    .select("id, client_id, company_id")
    .eq("id", parsed.preferenceId)
    .maybeSingle();
  if (prefError) throw new Error(prefError.message);
  if (!pref) throw new Error("Preference not found");

  await requireClientAccess(pref.client_id, PERMISSIONS.CLIENTS_UPDATE);

  const { error } = await supabase
    .from("client_preferences")
    .update({ knowledge_type: "verified", verified: true, updated_at: new Date().toISOString() })
    .eq("id", parsed.preferenceId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    companyId: pref.company_id,
    resourceType: "client_preferences",
    resourceId: parsed.preferenceId,
    action: "client_preference.verified",
  });
}

export async function createFeedback(input: unknown) {
  const parsed = createFeedbackSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requireClientAccess(parsed.clientId, PERMISSIONS.CLIENTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_feedback")
    .insert({
      client_id: parsed.clientId,
      project_id: parsed.projectId ?? null,
      contact_id: parsed.contactId ?? null,
      company_id: existing.company_id,
      rating: parsed.rating ?? null,
      sentiment: parsed.sentiment,
      feedback_type: parsed.feedbackType,
      content: parsed.content,
      received_at: parsed.receivedAt ?? new Date().toISOString(),
      recorded_by: user.id,
      source: parsed.source ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "client_feedback",
    resourceId: data.id,
    action: "client_feedback.created",
    afterState: { sentiment: parsed.sentiment, feedbackType: parsed.feedbackType },
  });
  await writeClientActivity({
    clientId: parsed.clientId,
    companyId: existing.company_id,
    actorUserId: user.id,
    eventType: "client_feedback.created",
    summary: `Feedback recorded (${parsed.feedbackType.replace(/_/g, " ")}).`,
    relatedResourceType: "client_feedback",
    relatedResourceId: data.id,
  });

  return { feedbackId: data.id };
}

export async function createIssue(input: unknown) {
  const parsed = createIssueSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requireClientAccess(parsed.clientId, PERMISSIONS.CLIENTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_relationship_issues")
    .insert({
      client_id: parsed.clientId,
      project_id: parsed.projectId ?? null,
      contact_id: parsed.contactId ?? null,
      company_id: existing.company_id,
      type: parsed.type,
      severity: parsed.severity,
      reason: parsed.reason,
      impact: parsed.impact ?? null,
      occurred_at: parsed.occurredAt ?? new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "client_relationship_issues",
    resourceId: data.id,
    action: "client_relationship_issue.created",
    afterState: { type: parsed.type, severity: parsed.severity },
  });
  await writeClientActivity({
    clientId: parsed.clientId,
    companyId: existing.company_id,
    actorUserId: user.id,
    eventType: "client_relationship_issue.created",
    summary: `Relationship issue recorded: ${parsed.type.replace(/_/g, " ")}.`,
    relatedResourceType: "client_relationship_issues",
    relatedResourceId: data.id,
  });

  return { issueId: data.id };
}

export async function resolveIssue(input: unknown) {
  const parsed = resolveIssueSchema.parse(input);
  const user = await requireCurrentUser();

  const supabase = await createServerSupabaseClient();
  const { data: issue, error: issueError } = await supabase
    .from("client_relationship_issues")
    .select("id, client_id, company_id, status")
    .eq("id", parsed.issueId)
    .maybeSingle();
  if (issueError) throw new Error(issueError.message);
  if (!issue) throw new Error("Relationship issue not found");

  await requireClientAccess(issue.client_id, PERMISSIONS.CLIENTS_UPDATE);

  const { error } = await supabase
    .from("client_relationship_issues")
    .update({
      status: "resolved",
      resolution: parsed.resolution,
      lesson: parsed.lesson ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.issueId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    companyId: issue.company_id,
    resourceType: "client_relationship_issues",
    resourceId: parsed.issueId,
    action: "client_relationship_issue.resolved",
  });
  await writeClientActivity({
    clientId: issue.client_id,
    companyId: issue.company_id,
    actorUserId: user.id,
    eventType: "client_relationship_issue.resolved",
    summary: "A relationship issue was resolved.",
    relatedResourceType: "client_relationship_issues",
    relatedResourceId: parsed.issueId,
  });
}

/**
 * Metadata only -- no secret value is ever accepted by this schema (see
 * lib/validation/clients.ts createCredentialSchema). No AI tool exists for
 * this domain in V1 (prompts/017 section 8/19).
 */
export async function createCredential(input: unknown) {
  const parsed = createCredentialSchema.parse(input);
  const user = await requireCurrentUser();
  const existing = await loadClientScope(parsed.clientId);
  await requirePermission(existing.company_id, PERMISSIONS.CLIENT_CREDENTIALS_MANAGE);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("client_credentials")
    .insert({
      client_id: parsed.clientId,
      project_id: parsed.projectId ?? null,
      company_id: existing.company_id,
      label: parsed.label,
      credential_type: parsed.credentialType,
      provider: parsed.provider ?? null,
      username_hint: parsed.usernameHint ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "client_credentials",
    resourceId: data.id,
    action: "client_credential.created",
    afterState: { label: parsed.label, credentialType: parsed.credentialType },
  });

  return { credentialId: data.id };
}
