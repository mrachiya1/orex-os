import { z } from "zod";

export const blockTypes = [
  "text", "heading", "callout", "checklist", "table", "divider", "link", "project_view",
] as const;
export type BlockType = (typeof blockTypes)[number];

export const textBlockContentSchema = z.object({ text: z.string() });

export const headingBlockContentSchema = z.object({
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const calloutBlockContentSchema = z.object({
  text: z.string(),
  tone: z.enum(["info", "warning", "success", "danger"]).default("info"),
});

export const checklistBlockContentSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        checked: z.boolean(),
      })
    )
    .max(200),
});

export const dividerBlockContentSchema = z.object({}).strict();

export const linkBlockContentSchema = z.object({
  url: z.string().url().max(2000),
  label: z.string().max(200),
});

const tableColumnTypes = ["text", "number", "select", "checkbox", "date", "url"] as const;

export const tableBlockContentSchema = z.object({
  columns: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100),
        type: z.enum(tableColumnTypes),
        options: z.array(z.string().max(100)).max(50).optional(),
      })
    )
    .max(20),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(500),
});

const projectViewSourceTypes = ["tasks", "milestones", "deliverables", "scope_changes", "readiness_checks"] as const;
export type ProjectViewSourceType = (typeof projectViewSourceTypes)[number];

/** Whitelisted sort fields per source type -- never an arbitrary column name. */
const SORT_FIELD_WHITELIST: Record<ProjectViewSourceType, string[]> = {
  tasks: ["due_date", "created_at", "priority"],
  milestones: ["due_date", "sequence", "created_at"],
  deliverables: ["due_date", "created_at"],
  scope_changes: ["created_at"],
  readiness_checks: ["sequence", "created_at"],
};

export const projectViewBlockContentSchema = z
  .object({
    sourceType: z.enum(projectViewSourceTypes),
    displayMode: z.enum(["list", "count"]).default("list"),
    filter: z
      .object({
        status: z.string().max(50).optional(),
        approvalState: z.string().max(50).optional(),
        isBlocking: z.boolean().optional(),
      })
      .optional(),
    sort: z
      .object({
        field: z.string().max(50),
        direction: z.enum(["asc", "desc"]).default("asc"),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.sort && !SORT_FIELD_WHITELIST[val.sourceType].includes(val.sort.field)) {
      ctx.addIssue({
        code: "custom",
        message: `sort.field "${val.sort.field}" is not allowed for sourceType "${val.sourceType}"`,
        path: ["sort", "field"],
      });
    }
  });

const blockContentSchemaByType: Record<BlockType, z.ZodType> = {
  text: textBlockContentSchema,
  heading: headingBlockContentSchema,
  callout: calloutBlockContentSchema,
  checklist: checklistBlockContentSchema,
  divider: dividerBlockContentSchema,
  link: linkBlockContentSchema,
  table: tableBlockContentSchema,
  project_view: projectViewBlockContentSchema,
};

/**
 * Validates a block's content against the schema for its declared
 * block_type -- never trusted as opaque JSON. Throws a ZodError (via
 * .parse) on any mismatch.
 */
export function validateBlockContent(blockType: BlockType, content: unknown) {
  return blockContentSchemaByType[blockType].parse(content);
}
