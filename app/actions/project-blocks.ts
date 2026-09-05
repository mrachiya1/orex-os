"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { writeProjectActivity } from "@/lib/projects/activity";
import { createServerSupabaseClient } from "@/lib/database/server";
import { validateBlockContent, linkBlockContentSchema } from "@/lib/validation/project-blocks";
import { assertSafeReferenceUrl } from "@/lib/projects/url-safety";
import {
  createBlockSchema,
  updateBlockSchema,
  deleteBlockSchema,
  moveBlockSchema,
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

function assertSafeUrlsInContent(blockType: string, content: unknown) {
  if (blockType === "link") {
    const parsed = linkBlockContentSchema.parse(content);
    assertSafeReferenceUrl(parsed.url);
  }
  if (blockType === "table" && content && typeof content === "object") {
    const columns = (content as { columns?: Array<{ type?: string }> }).columns ?? [];
    const rows = (content as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    const urlColumnIds = columns.filter((c) => c.type === "url").map((c) => (c as { id: string }).id);
    for (const row of rows) {
      for (const colId of urlColumnIds) {
        const value = row[colId];
        if (typeof value === "string" && value.length > 0) {
          assertSafeReferenceUrl(value);
        }
      }
    }
  }
}

export async function createBlock(input: unknown) {
  const parsed = createBlockSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();

  const { data: section, error: sectionError } = await supabase
    .from("project_sections")
    .select("section_type")
    .eq("id", parsed.sectionId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();
  if (sectionError) throw new Error(sectionError.message);
  if (!section) throw new Error("Section not found");
  if (section.section_type !== "custom") {
    throw new Error("Blocks may only be added to custom sections.");
  }

  const validatedContent = validateBlockContent(parsed.blockType, parsed.content);
  assertSafeUrlsInContent(parsed.blockType, validatedContent);

  const { count } = await supabase
    .from("project_blocks")
    .select("id", { count: "exact", head: true })
    .eq("section_id", parsed.sectionId);

  const { data: block, error } = await supabase
    .from("project_blocks")
    .insert({
      organisation_id: scope.organisation_id,
      company_id: scope.company_id,
      project_id: parsed.projectId,
      section_id: parsed.sectionId,
      block_type: parsed.blockType,
      position: count ?? 0,
      content: validatedContent,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_blocks",
    resourceId: block.id,
    action: "project_block.created",
    afterState: { blockType: parsed.blockType },
  });

  return { blockId: block.id };
}

/** Content edits only -- no audit/activity row per the "not one row per keystroke" instruction; updated_at/updated_by carry authorship. */
export async function updateBlock(input: unknown) {
  const parsed = updateBlockSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: block, error: blockError } = await supabase
    .from("project_blocks")
    .select("block_type")
    .eq("id", parsed.blockId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();
  if (blockError) throw new Error(blockError.message);
  if (!block) throw new Error("Block not found");

  const validatedContent = validateBlockContent(block.block_type, parsed.content);
  assertSafeUrlsInContent(block.block_type, validatedContent);

  const { error } = await supabase
    .from("project_blocks")
    .update({ content: validatedContent, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", parsed.blockId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);
}

export async function deleteBlock(input: unknown) {
  const parsed = deleteBlockSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);
  const scope = await getProjectScope(parsed.projectId);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_blocks")
    .delete()
    .eq("id", parsed.blockId)
    .eq("project_id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: scope.organisation_id,
    companyId: scope.company_id,
    resourceType: "project_blocks",
    resourceId: parsed.blockId,
    action: "project_block.deleted",
  });
}

export async function moveBlock(input: unknown) {
  const parsed = moveBlockSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: block, error: blockError } = await supabase
    .from("project_blocks")
    .select("section_id")
    .eq("id", parsed.blockId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();
  if (blockError) throw new Error(blockError.message);
  if (!block) throw new Error("Block not found");

  const { data: blocks, error } = await supabase
    .from("project_blocks")
    .select("id, position")
    .eq("section_id", block.section_id)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);

  const ordered = blocks ?? [];
  const index = ordered.findIndex((b) => b.id === parsed.blockId);
  if (index === -1) throw new Error("Block not found");

  const swapIndex = parsed.direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= ordered.length) return;

  const current = ordered[index];
  const swap = ordered[swapIndex];

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("project_blocks").update({ position: swap.position }).eq("id", current.id),
    supabase.from("project_blocks").update({ position: current.position }).eq("id", swap.id),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  await writeProjectActivity({
    projectId: parsed.projectId,
    actorUserId: user.id,
    eventType: "project_layout.changed",
    summary: "Block reordered",
  });
}
