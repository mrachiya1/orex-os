"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requirePermission, requireProjectAccess, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/database/server";
import {
  createFolderSchema,
  renameFolderSchema,
  moveFolderSchema,
  archiveFolderSchema,
  moveProjectToFolderSchema,
} from "@/lib/validation/project-folders";

/**
 * Folders are organisational metadata only -- creating/renaming/moving one
 * never changes who can read or write any project (docs/security.md
 * "Multi-Company Isolation" extends here: folder_id is never consulted by
 * any RLS policy on `projects`, only company_id/has_project_access are).
 */
export async function createFolder(input: unknown) {
  const parsed = createFolderSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("project_folders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", parsed.companyId)
    .is("parent_folder_id", parsed.parentFolderId ?? null);

  const { data: folder, error } = await supabase
    .from("project_folders")
    .insert({
      organisation_id: parsed.organisationId,
      company_id: parsed.companyId,
      name: parsed.name,
      parent_folder_id: parsed.parentFolderId ?? null,
      position: count ?? 0,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: parsed.organisationId,
    companyId: parsed.companyId,
    resourceType: "project_folders",
    resourceId: folder.id,
    action: "project_folder.created",
    afterState: { name: parsed.name },
  });

  return { folderId: folder.id };
}

export async function renameFolder(input: unknown) {
  const parsed = renameFolderSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("project_folders")
    .select("organisation_id")
    .eq("id", parsed.folderId)
    .maybeSingle();
  if (!existing) throw new Error("Folder not found");

  const { error } = await supabase
    .from("project_folders")
    .update({ name: parsed.name, updated_at: new Date().toISOString() })
    .eq("id", parsed.folderId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: parsed.companyId,
    resourceType: "project_folders",
    resourceId: parsed.folderId,
    action: "project_folder.renamed",
    afterState: { name: parsed.name },
  });
}

export async function moveFolder(input: unknown) {
  const parsed = moveFolderSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.PROJECTS_UPDATE);

  if (parsed.parentFolderId === parsed.folderId) {
    throw new Error("A folder cannot be its own parent.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("project_folders")
    .select("organisation_id")
    .eq("id", parsed.folderId)
    .maybeSingle();
  if (!existing) throw new Error("Folder not found");

  const { error } = await supabase
    .from("project_folders")
    .update({ parent_folder_id: parsed.parentFolderId, updated_at: new Date().toISOString() })
    .eq("id", parsed.folderId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: parsed.companyId,
    resourceType: "project_folders",
    resourceId: parsed.folderId,
    action: "project_folder.moved",
    afterState: { parentFolderId: parsed.parentFolderId },
  });
}

export async function archiveFolder(input: unknown) {
  const parsed = archiveFolderSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("project_folders")
    .select("organisation_id, name")
    .eq("id", parsed.folderId)
    .maybeSingle();
  if (!existing) throw new Error("Folder not found");

  const { error } = await supabase
    .from("project_folders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.folderId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: parsed.companyId,
    resourceType: "project_folders",
    resourceId: parsed.folderId,
    action: "project_folder.archived",
    beforeState: { name: existing.name },
  });
}

/** Moving a project between folders (or to Unfiled) never touches permissions. */
export async function moveProjectToFolder(input: unknown) {
  const parsed = moveProjectToFolderSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("projects")
    .select("organisation_id, company_id")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (!existing) throw new Error("Project not found");

  const { error } = await supabase
    .from("projects")
    .update({ folder_id: parsed.folderId, updated_at: new Date().toISOString() })
    .eq("id", parsed.projectId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "projects",
    resourceId: parsed.projectId,
    action: "project.updated",
    afterState: { folderId: parsed.folderId },
  });
}

export async function listFolders(companyId: string) {
  await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_folders")
    .select("id, name, parent_folder_id, position")
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}
