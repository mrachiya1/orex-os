import { z } from "zod";

/**
 * Shared shape for a project export/import file (prompts/011-project-
 * export-import.md). The writer (export route) and reader (import action)
 * both validate against this schema so they can never drift. `schemaVersion`
 * exists so a future format change fails loudly on import instead of
 * silently importing a mismatched shape. Every child array is capped well
 * above any real project's size, purely to stop a maliciously oversized
 * hand-edited file from causing a runaway insert on import -- these are not
 * product limits.
 */

const MAX_ROWS = 500;

const priorityValues = ["low", "normal", "high", "urgent"] as const;
const classificationValues = ["internal", "confidential", "restricted"] as const;
const statusValues = [
  "draft", "planned", "active", "on_hold", "review",
  "delivery_ready", "delivered", "completed", "cancelled", "archived",
] as const;
const healthValues = ["healthy", "attention", "at_risk", "blocked"] as const;
const milestoneStatusValues = ["pending", "in_progress", "completed", "blocked", "skipped"] as const;
const taskStatusValues = ["todo", "in_progress", "done", "blocked"] as const;
const deliverableStatusValues = ["in_progress", "internal_review", "client_review", "approved", "rejected"] as const;
const approvalStateValues = ["pending", "approved", "rejected"] as const;
const readinessStatusValues = ["pending", "complete", "skipped"] as const;
const blockTypeValues = ["text", "heading", "callout", "checklist", "table", "divider", "link", "project_view"] as const;
const propertyTypeValues = [
  "text", "number", "select", "multi_select", "status",
  "date", "person", "files", "checkbox", "url", "email", "phone",
] as const;

/**
 * User references are exported as an email, never a UUID -- a source
 * project's user ids are meaningless (or worse, collide with an unrelated
 * person) outside the company it was exported from. Import remaps a known
 * email to a real member of the *target* company, or leaves the field
 * unassigned if no match exists -- see app/actions/project-import.ts.
 */
const emailRef = z.string().email().nullable().optional();

export const projectExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  project: z.object({
    name: z.string().min(1).max(200),
    projectCode: z.string().min(1).max(50),
    projectType: z.string().min(1).max(100),
    clientDisplayName: z.string().max(200).nullable().optional(),
    description: z.string().nullable().optional(),
    scopeSummary: z.string().nullable().optional(),
    objectives: z.string().nullable().optional(),
    priority: z.enum(priorityValues),
    internalNotesClassification: z.enum(classificationValues),
    status: z.enum(statusValues),
    healthState: z.enum(healthValues),
    startDate: z.string().nullable().optional(),
    targetDate: z.string().nullable().optional(),
    ownerEmail: emailRef,
    leadEmail: emailRef,
  }),
  members: z
    .array(
      z.object({
        email: z.string().email(),
        projectRole: z.enum(["owner", "lead", "member", "contractor"]),
      })
    )
    .max(MAX_ROWS)
    .default([]),
  milestones: z
    .array(
      z.object({
        localId: z.string().min(1),
        parentLocalId: z.string().min(1).nullable().optional(),
        title: z.string().min(1).max(200),
        description: z.string().nullable().optional(),
        ownerEmail: emailRef,
        status: z.enum(milestoneStatusValues),
        sequence: z.number().int(),
        isBlocking: z.boolean(),
        dueDate: z.string().nullable().optional(),
      })
    )
    .max(MAX_ROWS)
    .default([]),
  tasks: z
    .array(
      z.object({
        milestoneLocalId: z.string().min(1).nullable().optional(),
        title: z.string().min(1).max(200),
        description: z.string().nullable().optional(),
        status: z.enum(taskStatusValues),
        priority: z.enum(priorityValues),
        assigneeEmail: emailRef,
        dueDate: z.string().nullable().optional(),
      })
    )
    .max(MAX_ROWS)
    .default([]),
  deliverables: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().nullable().optional(),
        deliverableType: z.string().min(1).max(100),
        isRequired: z.boolean(),
        status: z.enum(deliverableStatusValues),
        ownerEmail: emailRef,
        version: z.string().max(50).nullable().optional(),
        dueDate: z.string().nullable().optional(),
        approvalState: z.enum(approvalStateValues),
        referenceUrl: z.string().max(2000).nullable().optional(),
        referenceNote: z.string().max(500).nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .max(MAX_ROWS)
    .default([]),
  scopeChanges: z
    .array(
      z.object({
        summary: z.string().min(1),
        reason: z.string().nullable().optional(),
        impactSummary: z.string().nullable().optional(),
        requestedByEmail: emailRef,
        approvalState: z.enum(approvalStateValues),
        isBlocking: z.boolean(),
      })
    )
    .max(MAX_ROWS)
    .default([]),
  readinessChecks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().nullable().optional(),
        isRequired: z.boolean(),
        status: z.enum(readinessStatusValues),
        sequence: z.number().int(),
        evidenceNote: z.string().max(1000).nullable().optional(),
      })
    )
    .max(MAX_ROWS)
    .default([]),
  sections: z
    .array(
      z.object({
        localId: z.string().min(1),
        title: z.string().min(1).max(200),
        position: z.number().int(),
        isCollapsed: z.boolean(),
        isHidden: z.boolean(),
      })
    )
    .max(MAX_ROWS)
    .default([]),
  blocks: z
    .array(
      z.object({
        sectionLocalId: z.string().min(1),
        blockType: z.enum(blockTypeValues),
        position: z.number().int(),
        content: z.record(z.string(), z.unknown()),
      })
    )
    .max(MAX_ROWS)
    .default([]),
  propertyValues: z
    .array(
      z.object({
        propertyName: z.string().min(1).max(200),
        propertyType: z.enum(propertyTypeValues),
        value: z.unknown(),
      })
    )
    .max(MAX_ROWS)
    .default([]),
});

export type ProjectExport = z.infer<typeof projectExportSchema>;
