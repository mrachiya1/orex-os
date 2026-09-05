"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import {
  createSectionSchema,
  renameSectionSchema,
  toggleSectionCollapsedSchema,
  toggleSectionHiddenSchema,
  moveSectionSchema,
  deleteSectionSchema,
  duplicateSectionSchema,
} from "@/lib/validation/project-workspace";

async function getProjectScope(projectId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("organisation_id, company_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found");
  return data;
}

export async function createSection(input: unknown) {
  const parsed = createSectionSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("project_sections")
    .select("id", { count: "exact", head: true })
    .eq("project_id", parsed.projectId);

  const { data: section, error } = await supabase
    .from("project_sections")
    .insert({
      organisation_id: scope.organisation_id,
      company_id: scope.company_id,
      project_id: parsed.projectId,
      title: parsed.title,
      section_type: "custom",
      position: count ?? 0,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_sections",
    resourceId: section.id,
    action: "project_section.created",
    afterState: { title: parsed.title },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "project_section.created",
    summary: `Section "${parsed.title}" added`,
  });

  return { sectionId: section.id };
}

export async function renameSection(input: unknown) {
  const parsed = renameSectionSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_sections")
    .update({ title: parsed.title, updated_at: new Date().toISOString() })
    .eq("id", parsed.sectionId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_sections",
    resourceId: parsed.sectionId,
    action: "project_section.renamed",
    afterState: { title: parsed.title },
  });
}

export async function toggleSectionCollapsed(input: unknown) {
  const parsed = toggleSectionCollapsedSchema.parse(input);
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_sections")
    .update({ is_collapsed: parsed.isCollapsed, updated_at: new Date().toISOString() })
    .eq("id", parsed.sectionId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);
}

export async function toggleSectionHidden(input: unknown) {
  const parsed = toggleSectionHiddenSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_sections")
    .update({ is_hidden: parsed.isHidden, updated_at: new Date().toISOString() })
    .eq("id", parsed.sectionId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "project_layout.changed",
    summary: parsed.isHidden ? "Section hidden from workspace" : "Section shown in workspace",
  });
}

export async function moveSection(input: unknown) {
  const parsed = moveSectionSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: sections, error } = await supabase
    .from("project_sections")
    .select("id, position")
    .eq("project_id", parsed.projectId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);

  const ordered = sections ?? [];
  const index = ordered.findIndex((s) => s.id === parsed.sectionId);
  if (index === -1) throw new Error("Section not found");

  const swapIndex = parsed.direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= ordered.length) return;

  const current = ordered[index];
  const swap = ordered[swapIndex];

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("project_sections").update({ position: swap.position }).eq("id", current.id),
    supabase.from("project_sections").update({ position: current.position }).eq("id", swap.id),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "project_layout.changed",
    summary: "Section reordered",
  });
}

/** System sections can only be hidden, never deleted -- they carry no real data, only presentation state, but deleting them would lose the workspace's remembered position/collapse preference for no benefit. */
export async function deleteSection(input: unknown) {
  const parsed = deleteSectionSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: section, error: sectionError } = await supabase
    .from("project_sections")
    .select("section_type, title")
    .eq("id", parsed.sectionId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();
  if (sectionError) throw new Error(sectionError.message);
  if (!section) throw new Error("Section not found");
  if (section.section_type === "system") {
    throw new Error("System sections cannot be deleted -- hide it instead.");
  }

  const { error } = await supabase
    .from("project_sections")
    .delete()
    .eq("id", parsed.sectionId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_sections",
    resourceId: parsed.sectionId,
    action: "project_section.deleted",
    beforeState: { title: section.title },
  });
  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "project_section.deleted",
    summary: `Section "${section.title}" deleted`,
  });
}

export async function duplicateSection(input: unknown) {
  const parsed = duplicateSectionSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { data: original, error: originalError } = await supabase
    .from("project_sections")
    .select("title, section_type")
    .eq("id", parsed.sectionId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();
  if (originalError) throw new Error(originalError.message);
  if (!original) throw new Error("Section not found");
  if (original.section_type !== "custom") {
    throw new Error("Only custom sections can be duplicated.");
  }

  const { data: blocks, error: blocksError } = await supabase
    .from("project_blocks")
    .select("block_type, position, content")
    .eq("section_id", parsed.sectionId);
  if (blocksError) throw new Error(blocksError.message);

  const { count } = await supabase
    .from("project_sections")
    .select("id", { count: "exact", head: true })
    .eq("project_id", parsed.projectId);

  const { data: newSection, error: newSectionError } = await supabase
    .from("project_sections")
    .insert({
      organisation_id: scope.organisation_id,
      company_id: scope.company_id,
      project_id: parsed.projectId,
      title: `${original.title} (copy)`,
      section_type: "custom",
      position: count ?? 0,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (newSectionError) throw new Error(newSectionError.message);

  if (blocks && blocks.length > 0) {
    const { error: insertBlocksError } = await supabase.from("project_blocks").insert(
      blocks.map((b) => ({
        organisation_id: scope.organisation_id,
        company_id: scope.company_id,
        project_id: parsed.projectId,
        section_id: newSection.id,
        block_type: b.block_type,
        position: b.position,
        content: b.content,
        created_by: user.id,
      }))
    );
    if (insertBlocksError) throw new Error(insertBlocksError.message);
  }

  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "project_section.created",
    summary: `Section "${original.title}" duplicated`,
  });

  return { sectionId: newSection.id };
}
