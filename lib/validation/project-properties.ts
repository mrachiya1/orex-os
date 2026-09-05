import { z } from "zod";
import { assertSafeReferenceUrl } from "@/lib/projects/url-safety";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/projects/property-types";

export { PROPERTY_TYPES, type PropertyType } from "@/lib/projects/property-types";

const optionSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  color: z.string().max(30).optional(),
});

/**
 * Per-type `configuration` shape on project_property_definitions. Only
 * select/multi_select/status carry real configuration (their option list);
 * everything else gets an empty object. Never trusted as opaque JSON.
 */
const configSchemaByType: Record<PropertyType, z.ZodTypeAny> = {
  text: z.object({}).strict(),
  number: z.object({ currency: z.string().max(10).optional() }).strict(),
  select: z.object({ options: z.array(optionSchema).min(1).max(40) }).strict(),
  multi_select: z.object({ options: z.array(optionSchema).min(1).max(40) }).strict(),
  status: z.object({ options: z.array(optionSchema).min(1).max(40) }).strict(),
  date: z.object({}).strict(),
  person: z.object({}).strict(),
  files: z.object({}).strict(),
  checkbox: z.object({}).strict(),
  url: z.object({}).strict(),
  email: z.object({}).strict(),
  phone: z.object({}).strict(),
};

export function validatePropertyConfiguration(propertyType: PropertyType, configuration: unknown) {
  const schema = configSchemaByType[propertyType];
  if (!schema) throw new Error(`Unknown property type: ${propertyType}`);
  return schema.parse(configuration ?? {});
}

export const createPropertyDefinitionSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(60),
  propertyType: z.enum(PROPERTY_TYPES),
  configuration: z.unknown().optional(),
});

export const updatePropertyDefinitionSchema = z.object({
  propertyDefinitionId: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(60).optional(),
  configuration: z.unknown().optional(),
  position: z.number().int().optional(),
});

export const deletePropertyDefinitionSchema = z.object({
  propertyDefinitionId: z.string().uuid(),
  companyId: z.string().uuid(),
});

export const setPropertyValueSchema = z.object({
  projectId: z.string().uuid(),
  propertyDefinitionId: z.string().uuid(),
  value: z.unknown(),
});

/**
 * Validates a property VALUE against its definition's type -- mirrors
 * validateBlockContent (Phase 004.5) for the same reason: an opaque jsonb
 * column must never accept arbitrary client JSON. `options` (for
 * select/multi_select/status) narrows the accepted value to option ids
 * already configured on the definition; `companyMemberIds` narrows a
 * `person` value to a real, currently-authorized company member.
 */
export function validatePropertyValue(
  propertyType: PropertyType,
  configuration: { options?: Array<{ id: string; label?: string }> },
  value: unknown,
  companyMemberIds?: Set<string>
): unknown {
  switch (propertyType) {
    case "text":
      return z.string().max(2000).nullable().parse(value);
    case "number":
      return z.number().finite().nullable().parse(value);
    case "checkbox":
      return z.boolean().parse(value ?? false);
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().parse(value);
    case "email":
      return z.string().email().max(200).nullable().parse(value);
    case "phone":
      return z.string().max(40).nullable().parse(value);
    case "url": {
      const parsed = z.string().max(2000).nullable().parse(value);
      if (parsed) assertSafeReferenceUrl(parsed);
      return parsed;
    }
    case "select": {
      const parsed = z.string().nullable().parse(value);
      const validIds = new Set((configuration.options ?? []).map((o) => o.id));
      if (parsed && !validIds.has(parsed)) {
        throw new Error(`"${parsed}" is not a configured option for this property.`);
      }
      return parsed;
    }
    case "multi_select": {
      const parsed = z.array(z.string()).max(40).parse(value ?? []);
      const validIds = new Set((configuration.options ?? []).map((o) => o.id));
      for (const id of parsed) {
        if (!validIds.has(id)) throw new Error(`"${id}" is not a configured option for this property.`);
      }
      return parsed;
    }
    case "status": {
      const parsed = z.string().nullable().parse(value);
      const validIds = new Set((configuration.options ?? []).map((o) => o.id));
      if (parsed && !validIds.has(parsed)) {
        throw new Error(`"${parsed}" is not a configured status for this property.`);
      }
      return parsed;
    }
    case "person": {
      const parsed = z.string().uuid().nullable().parse(value);
      if (parsed && companyMemberIds && !companyMemberIds.has(parsed)) {
        throw new Error("Person value must reference a real, currently-authorized company member.");
      }
      return parsed;
    }
    case "files":
      throw new Error("The 'files' property type is not yet supported for value entry.");
    default:
      throw new Error(`Unknown property type: ${propertyType}`);
  }
}

export const setMyProjectViewSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid(),
  configuration: z.object({
    visibleColumns: z.array(z.string()).max(60),
    order: z.array(z.string()).max(60),
  }),
});
