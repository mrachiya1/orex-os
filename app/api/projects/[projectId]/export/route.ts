import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/database/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import type { ProjectExport } from "@/lib/validation/project-export";

/**
 * Exports one project as a downloadable JSON file (prompts/011-project-
 * export-import.md). A Route Handler, not a Server Action, because a
 * Server Action cannot trigger a real browser file download -- this
 * returns Content-Disposition: attachment instead.
 *
 * Gated on the same projects.read check as viewing the project; every
 * query below uses the normal authenticated client (not service-role), so
 * RLS -- not this handler -- is what actually limits which child rows come
 * back if the caller can see the project itself but lacks a narrower
 * permission (e.g. deliverables.read) for one of its child tables. That
 * mirrors every other read path in this app (see getProjectMilestoneSummary
 * in app/actions/projects.ts).
 *
 * Deliberately excluded from the export (see the prompt's "Decisions" #3-4):
 * project_deliveries (append-only delivery history), project_activity (an
 * audit-style timeline), decisions (a separate top-level entity, not owned
 * by the project), and anything from the secrets vault or finance tables
 * (none of which this project's own tables ever reference).
 */
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  await requireCurrentUser();
  await requireProjectAccess(projectId, PERMISSIONS.PROJECTS_READ);

  const supabase = await createServerSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "name, project_code, project_type, client_display_name, description, scope_summary, objectives, priority, internal_notes_classification, status, health_state, start_date, target_date, owner:user_profiles!owner_id(email), lead:user_profiles!lead_id(email)"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [
    { data: members },
    { data: milestones },
    { data: tasks },
    { data: deliverables },
    { data: scopeChanges },
    { data: readinessChecks },
    { data: sections },
    { data: propertyValues },
  ] = await Promise.all([
    supabase
      .from("project_members")
      .select("project_role, status, user:user_profiles!user_id(email)")
      .eq("project_id", projectId)
      .eq("status", "active"),
    supabase
      .from("project_milestones")
      .select("id, parent_milestone_id, title, description, status, sequence, is_blocking, due_date, owner:user_profiles!owner_id(email)")
      .eq("project_id", projectId),
    supabase
      .from("project_tasks")
      .select("milestone_id, title, description, status, priority, due_date, assignee:user_profiles!assignee_user_id(email)")
      .eq("project_id", projectId),
    supabase
      .from("project_deliverables")
      .select(
        "title, description, deliverable_type, is_required, status, version, due_date, approval_state, reference_url, reference_note, notes, owner:user_profiles!owner_id(email)"
      )
      .eq("project_id", projectId),
    supabase
      .from("project_scope_changes")
      .select("summary, reason, impact_summary, approval_state, is_blocking, requester:user_profiles!requested_by(email)")
      .eq("project_id", projectId),
    supabase
      .from("project_readiness_checks")
      .select("title, description, is_required, status, sequence, evidence_note")
      .eq("project_id", projectId),
    supabase
      .from("project_sections")
      .select("id, title, position, is_collapsed, is_hidden, project_blocks(id, block_type, position, content)")
      .eq("project_id", projectId)
      .eq("section_type", "custom"),
    supabase
      .from("project_property_values")
      .select("value, project_property_definitions(name, property_type)")
      .eq("project_id", projectId),
  ]);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  const blocks: ProjectExport["blocks"] = [];
  const exportSections: ProjectExport["sections"] = (sections ?? []).map((s) => {
    for (const b of s.project_blocks ?? []) {
      blocks.push({
        sectionLocalId: s.id,
        blockType: b.block_type,
        position: b.position,
        content: (b.content ?? {}) as Record<string, unknown>,
      });
    }
    return { localId: s.id, title: s.title, position: s.position, isCollapsed: s.is_collapsed, isHidden: s.is_hidden };
  });

  const payload: ProjectExport = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      projectCode: project.project_code,
      projectType: project.project_type,
      clientDisplayName: project.client_display_name,
      description: project.description,
      scopeSummary: project.scope_summary,
      objectives: project.objectives,
      priority: project.priority,
      internalNotesClassification: project.internal_notes_classification,
      status: project.status,
      healthState: project.health_state,
      startDate: project.start_date,
      targetDate: project.target_date,
      ownerEmail: one(project.owner)?.email ?? null,
      leadEmail: one(project.lead)?.email ?? null,
    },
    members: (members ?? []).map((m) => ({
      email: one(m.user)?.email ?? "",
      projectRole: m.project_role,
    })).filter((m) => m.email),
    milestones: (milestones ?? []).map((m) => ({
      localId: m.id,
      parentLocalId: m.parent_milestone_id,
      title: m.title,
      description: m.description,
      ownerEmail: one(m.owner)?.email ?? null,
      status: m.status,
      sequence: m.sequence,
      isBlocking: m.is_blocking,
      dueDate: m.due_date,
    })),
    tasks: (tasks ?? []).map((t) => ({
      milestoneLocalId: t.milestone_id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assigneeEmail: one(t.assignee)?.email ?? null,
      dueDate: t.due_date,
    })),
    deliverables: (deliverables ?? []).map((d) => ({
      title: d.title,
      description: d.description,
      deliverableType: d.deliverable_type,
      isRequired: d.is_required,
      status: d.status,
      ownerEmail: one(d.owner)?.email ?? null,
      version: d.version,
      dueDate: d.due_date,
      approvalState: d.approval_state,
      referenceUrl: d.reference_url,
      referenceNote: d.reference_note,
      notes: d.notes,
    })),
    scopeChanges: (scopeChanges ?? []).map((s) => ({
      summary: s.summary,
      reason: s.reason,
      impactSummary: s.impact_summary,
      requestedByEmail: one(s.requester)?.email ?? null,
      approvalState: s.approval_state,
      isBlocking: s.is_blocking,
    })),
    readinessChecks: (readinessChecks ?? []).map((r) => ({
      title: r.title,
      description: r.description,
      isRequired: r.is_required,
      status: r.status,
      sequence: r.sequence,
      evidenceNote: r.evidence_note,
    })),
    sections: exportSections,
    blocks,
    propertyValues: (propertyValues ?? [])
      .map((v) => {
        const def = one(v.project_property_definitions);
        return def ? { propertyName: def.name, propertyType: def.property_type, value: v.value } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null),
  };

  const fileName = `${project.project_code || "project"}.orexos-project.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    },
  });
}
