"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { requirePermission, requireProjectAccess, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/database/server";
import {
  createPropertyDefinitionSchema,
  updatePropertyDefinitionSchema,
  deletePropertyDefinitionSchema,
  setPropertyValueSchema,
  validatePropertyConfiguration,
  validatePropertyValue,
  type PropertyType,
} from "@/lib/validation/project-properties";

/** Custom project properties are always company-scoped in this slice -- an
 * org-wide (company_id null) definition is supported by the schema but not
 * exposed in the UI yet (see prompts/007 "Remaining Gaps"). */
export async function createPropertyDefinition(input: unknown) {
  const parsed = createPropertyDefinitionSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.PROJECTS_UPDATE);

  const configuration = validatePropertyConfiguration(parsed.propertyType, parsed.configuration);

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("project_property_definitions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", parsed.companyId);

  const { data: def, error } = await supabase
    .from("project_property_definitions")
    .insert({
      organisation_id: parsed.organisationId,
      company_id: parsed.companyId,
      name: parsed.name,
      property_type: parsed.propertyType,
      configuration,
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
    resourceType: "project_property_definitions",
    resourceId: def.id,
    action: "project_property.created",
    afterState: { name: parsed.name, propertyType: parsed.propertyType },
  });

  return { propertyDefinitionId: def.id };
}

export async function updatePropertyDefinition(input: unknown) {
  const parsed = updatePropertyDefinitionSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("project_property_definitions")
    .select("organisation_id, company_id, property_type")
    .eq("id", parsed.propertyDefinitionId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Property not found");

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.name !== undefined) updates.name = parsed.name;
  if (parsed.position !== undefined) updates.position = parsed.position;
  if (parsed.configuration !== undefined) {
    updates.configuration = validatePropertyConfiguration(
      existing.property_type as PropertyType,
      parsed.configuration
    );
  }

  const { error } = await supabase
    .from("project_property_definitions")
    .update(updates)
    .eq("id", parsed.propertyDefinitionId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "project_property_definitions",
    resourceId: parsed.propertyDefinitionId,
    action: "project_property.updated",
    afterState: updates,
  });
}

export async function deletePropertyDefinition(input: unknown) {
  const parsed = deletePropertyDefinitionSchema.parse(input);
  const user = await requireCurrentUser();
  await requirePermission(parsed.companyId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("project_property_definitions")
    .select("organisation_id, company_id, name")
    .eq("id", parsed.propertyDefinitionId)
    .maybeSingle();
  if (!existing) throw new Error("Property not found");

  const { error } = await supabase
    .from("project_property_definitions")
    .delete()
    .eq("id", parsed.propertyDefinitionId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    actorUserId: user.id,
    organisationId: existing.organisation_id,
    companyId: existing.company_id,
    resourceType: "project_property_definitions",
    resourceId: parsed.propertyDefinitionId,
    action: "project_property.deleted",
    beforeState: { name: existing.name },
  });
}

/**
 * Setting a value never bypasses lifecycle rules -- this only ever touches
 * project_property_values (custom metadata), never a system column like
 * `status`. Status changes always go through changeProjectStatus().
 */
export async function setPropertyValue(input: unknown) {
  const parsed = setPropertyValueSchema.parse(input);
  const user = await requireCurrentUser();
  await requireProjectAccess(parsed.projectId, PERMISSIONS.PROJECTS_UPDATE);

  const supabase = await createServerSupabaseClient();
  const { data: def, error: defError } = await supabase
    .from("project_property_definitions")
    .select("id, property_type, configuration, company_id")
    .eq("id", parsed.propertyDefinitionId)
    .maybeSingle();
  if (defError) throw new Error(defError.message);
  if (!def) throw new Error("Property definition not found");

  let companyMemberIds: Set<string> | undefined;
  if (def.property_type === "person" && def.company_id) {
    const { data: members } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", def.company_id)
      .eq("status", "active");
    companyMemberIds = new Set((members ?? []).map((m) => m.user_id));
  }

  const value = validatePropertyValue(
    def.property_type as PropertyType,
    def.configuration as { options?: Array<{ id: string }> },
    parsed.value,
    companyMemberIds
  );

  const { error } = await supabase.from("project_property_values").upsert(
    {
      project_id: parsed.projectId,
      property_definition_id: parsed.propertyDefinitionId,
      value,
      created_by: user.id,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,property_definition_id" }
  );
  if (error) throw new Error(error.message);
}

/** Read-only helper for the table UI: definitions + values for one company's projects. */
export async function listPropertyDefinitions(companyId: string) {
  await requireCurrentUser();
  const canRead = await hasPermission(companyId, PERMISSIONS.PROJECTS_READ);
  if (!canRead) throw new Error("Forbidden");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_property_definitions")
    .select("id, name, property_type, configuration, position")
    .eq("company_id", companyId)
    .order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}
