"use server";

import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { requireScopedPermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { ensureDefaultWorkspaceSections } from "@/lib/projects/workspace";
import { createServerSupabaseClient } from "@/lib/database/server";
import { projectExportSchema } from "@/lib/validation/project-export";
import type { ActionResult } from "@/lib/actions/result";

const importProjectInputSchema = z.object({
  companyId: z.string().uuid(),
  organisationId: z.string().uuid(),
  file: projectExportSchema,
});

/**
 * Creates a brand-new project in the CALLER's target company from a
 * previously-exported file (prompts/011-project-export-import.md). Never
 * upserts over an existing project, never trusts any id in the file --
 * every user reference is exported as an email and only ever remapped to a
 * real member of the target company; an email with no match in this
 * company is imported as unassigned (null), never silently assigned to the
 * importing user and never left as a dangling id from another company.
 *
 * Emulates atomicity without a DB transaction (the Supabase JS client has
 * none): if any insert after the initial `projects` row fails, the whole
 * project row is deleted, which cascades every child row already written
 * (every child table is `on delete cascade` from projects -- see
 * 0019/0023/0027 migrations) so no partial project is ever left behind.
 */
export async function importProject(input: unknown): Promise<ActionResult<{ projectId: string }>> {
  const parsed = importProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This file is not a valid Orex OS project export." };
  }
  const { companyId, organisationId, file: data } = parsed.data;

  const user = await requireCurrentUser();
  try {
    await requireScopedPermission(companyId, organisationId, PERMISSIONS.PROJECTS_CREATE);
  } catch {
    return { ok: false, error: "You do not have permission to create projects in this company." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: memberRows, error: memberError } = await supabase
    .from("company_members")
    .select("user_id, user_profiles(email)")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (memberError) return { ok: false, error: "Something went wrong. Please try again." };

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

  const emailToUserId = new Map<string, string>();
  for (const row of memberRows ?? []) {
    const email = one(row.user_profiles)?.email;
    if (email) emailToUserId.set(email.toLowerCase(), row.user_id);
  }
  const resolveUser = (email: string | null | undefined): string | null =>
    email ? (emailToUserId.get(email.toLowerCase()) ?? null) : null;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      organisation_id: organisationId,
      company_id: companyId,
      name: data.project.name,
      project_code: data.project.projectCode,
      project_type: data.project.projectType,
      client_display_name: data.project.clientDisplayName ?? null,
      description: data.project.description ?? null,
      scope_summary: data.project.scopeSummary ?? null,
      objectives: data.project.objectives ?? null,
      priority: data.project.priority,
      internal_notes_classification: data.project.internalNotesClassification,
      owner_id: resolveUser(data.project.ownerEmail),
      lead_id: resolveUser(data.project.leadEmail),
      start_date: data.project.startDate ?? null,
      target_date: data.project.targetDate ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (projectError) return { ok: false, error: "Could not create the project." };

  const projectId = project.id as string;

  async function rollback(reason: string): Promise<ActionResult<{ projectId: string }>> {
    await supabase.from("projects").delete().eq("id", projectId);
    return { ok: false, error: reason };
  }

  try {
    await ensureDefaultWorkspaceSections({ projectId, organisationId, companyId, userId: user.id });

    if (data.members.length > 0) {
      const rows = data.members
        .map((m) => ({ user_id: resolveUser(m.email), project_role: m.projectRole }))
        .filter((m): m is { user_id: string; project_role: (typeof data.members)[number]["projectRole"] } => m.user_id !== null)
        .map((m) => ({
          project_id: projectId,
          user_id: m.user_id,
          project_role: m.project_role,
          status: "active" as const,
          added_by: user.id,
        }));
      if (rows.length > 0) {
        const { error } = await supabase.from("project_members").insert(rows);
        if (error) return rollback(error.message);
      }
    }

    // Milestones: topologically ordered (a parent is always inserted
    // before its children) so parent_milestone_id can be remapped from the
    // file's localId to the newly-generated id at insert time.
    const milestoneIdMap = new Map<string, string>();
    let remaining = [...data.milestones];
    let guard = 0;
    while (remaining.length > 0) {
      guard += 1;
      if (guard > data.milestones.length + 5) {
        return rollback("The milestone hierarchy in this file is malformed (a cycle or a missing parent).");
      }
      const ready = remaining.filter((m) => !m.parentLocalId || milestoneIdMap.has(m.parentLocalId));
      if (ready.length === 0) {
        return rollback("The milestone hierarchy in this file is malformed (a cycle or a missing parent).");
      }
      for (const m of ready) {
        const { data: inserted, error } = await supabase
          .from("project_milestones")
          .insert({
            project_id: projectId,
            parent_milestone_id: m.parentLocalId ? milestoneIdMap.get(m.parentLocalId) : null,
            title: m.title,
            description: m.description ?? null,
            owner_id: resolveUser(m.ownerEmail),
            status: m.status,
            sequence: m.sequence,
            is_blocking: m.isBlocking,
            due_date: m.dueDate ?? null,
          })
          .select("id")
          .single();
        if (error) return rollback(error.message);
        milestoneIdMap.set(m.localId, inserted.id);
      }
      remaining = remaining.filter((m) => !milestoneIdMap.has(m.localId));
    }

    if (data.tasks.length > 0) {
      const rows = data.tasks.map((t) => ({
        project_id: projectId,
        milestone_id: t.milestoneLocalId ? (milestoneIdMap.get(t.milestoneLocalId) ?? null) : null,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        assignee_user_id: resolveUser(t.assigneeEmail),
        due_date: t.dueDate ?? null,
        created_by: user.id,
      }));
      const { error } = await supabase.from("project_tasks").insert(rows);
      if (error) return rollback(error.message);
    }

    if (data.deliverables.length > 0) {
      const rows = data.deliverables.map((d) => ({
        project_id: projectId,
        title: d.title,
        description: d.description ?? null,
        deliverable_type: d.deliverableType,
        is_required: d.isRequired,
        status: d.status,
        owner_id: resolveUser(d.ownerEmail),
        version: d.version ?? null,
        due_date: d.dueDate ?? null,
        approval_state: d.approvalState,
        reference_url: d.referenceUrl ?? null,
        reference_note: d.referenceNote ?? null,
        notes: d.notes ?? null,
      }));
      const { error } = await supabase.from("project_deliverables").insert(rows);
      if (error) return rollback(error.message);
    }

    if (data.scopeChanges.length > 0) {
      const rows = data.scopeChanges.map((s) => ({
        project_id: projectId,
        summary: s.summary,
        reason: s.reason ?? null,
        impact_summary: s.impactSummary ?? null,
        requested_by: resolveUser(s.requestedByEmail),
        approval_state: s.approvalState,
        is_blocking: s.isBlocking,
      }));
      const { error } = await supabase.from("project_scope_changes").insert(rows);
      if (error) return rollback(error.message);
    }

    if (data.readinessChecks.length > 0) {
      const rows = data.readinessChecks.map((r) => ({
        project_id: projectId,
        title: r.title,
        description: r.description ?? null,
        is_required: r.isRequired,
        status: r.status,
        sequence: r.sequence,
        evidence_note: r.evidenceNote ?? null,
        created_by: user.id,
      }));
      const { error } = await supabase.from("project_readiness_checks").insert(rows);
      if (error) return rollback(error.message);
    }

    // Custom sections + blocks only -- ensureDefaultWorkspaceSections above
    // already seeded the 8 system sections and the 3 default custom ones
    // fresh for this new project; the source project's own additional
    // custom sections are appended after them, never replacing them.
    const sectionIdMap = new Map<string, string>();
    if (data.sections.length > 0) {
      let position = 1000;
      for (const s of data.sections) {
        const { data: inserted, error } = await supabase
          .from("project_sections")
          .insert({
            organisation_id: organisationId,
            company_id: companyId,
            project_id: projectId,
            title: s.title,
            section_type: "custom",
            position: position++,
            is_collapsed: s.isCollapsed,
            is_hidden: s.isHidden,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error) return rollback(error.message);
        sectionIdMap.set(s.localId, inserted.id);
      }
    }

    if (data.blocks.length > 0) {
      const rows = data.blocks
        .map((b) => {
          const sectionId = sectionIdMap.get(b.sectionLocalId);
          return sectionId
            ? {
                organisation_id: organisationId,
                company_id: companyId,
                project_id: projectId,
                section_id: sectionId,
                block_type: b.blockType,
                position: b.position,
                content: b.content,
                created_by: user.id,
              }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) {
        const { error } = await supabase.from("project_blocks").insert(rows);
        if (error) return rollback(error.message);
      }
    }

    // Property values only for definitions that already exist in the
    // TARGET company -- importing a project never auto-creates a new
    // company-wide property definition as a side effect.
    if (data.propertyValues.length > 0) {
      const { data: definitions, error: defError } = await supabase
        .from("project_property_definitions")
        .select("id, name, property_type")
        .eq("company_id", companyId);
      if (defError) return rollback(defError.message);
      const defByKey = new Map((definitions ?? []).map((d) => [`${d.name.toLowerCase()}::${d.property_type}`, d.id]));

      const rows = data.propertyValues
        .map((v) => {
          const definitionId = defByKey.get(`${v.propertyName.toLowerCase()}::${v.propertyType}`);
          return definitionId
            ? {
                organisation_id: organisationId,
                company_id: companyId,
                project_id: projectId,
                property_definition_id: definitionId,
                value: v.value ?? null,
                created_by: user.id,
              }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) {
        const { error } = await supabase.from("project_property_values").insert(rows);
        if (error) return rollback(error.message);
      }
    }
  } catch (err) {
    return rollback(err instanceof Error ? err.message : "Something went wrong. Please try again.");
  }

  await writeAuditLog({
    actorUserId: user.id,
    organisationId,
    companyId,
    resourceType: "projects",
    resourceId: projectId,
    action: "project.imported",
    afterState: {
      name: data.project.name,
      counts: {
        milestones: data.milestones.length,
        tasks: data.tasks.length,
        deliverables: data.deliverables.length,
      },
    },
  });
  await writeProjectActivity({
    projectId,
    actorUserId: user.id,
    eventType: "project.imported",
    summary: `Project imported from an exported file ("${data.project.name}")`,
  });

  return { ok: true, projectId };
}
