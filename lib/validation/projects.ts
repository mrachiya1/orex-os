import { z } from "zod";

const statusValues = [
  "draft", "planned", "active", "on_hold", "review",
  "delivery_ready", "delivered", "completed", "cancelled", "archived",
] as const;
const healthValues = ["healthy", "attention", "at_risk", "blocked"] as const;
const priorityValues = ["low", "normal", "high", "urgent"] as const;
const classificationValues = ["internal", "confidential", "restricted"] as const;

export const createProjectSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  folderId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  projectCode: z.string().min(1).max(50),
  projectType: z.string().min(1).max(100),
  clientDisplayName: z.string().max(200).optional(),
  ownerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  targetDate: z.string().optional(),
  description: z.string().optional(),
  scopeSummary: z.string().optional(),
  objectives: z.string().optional(),
  priority: z.enum(priorityValues).default("normal"),
  internalNotesClassification: z.enum(classificationValues).default("internal"),
});

export const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  projectType: z.string().min(1).max(100).optional(),
  clientDisplayName: z.string().max(200).optional(),
  ownerId: z.string().uuid().optional(),
  leadId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  scopeSummary: z.string().optional(),
  objectives: z.string().optional(),
  priority: z.enum(priorityValues).optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  internalNotesClassification: z.enum(classificationValues).optional(),
});

export const changeProjectStatusSchema = z.object({
  projectId: z.string().uuid(),
  targetStatus: z.enum(statusValues),
  reason: z.string().max(500).optional(),
});

export const markDeliveryReadySchema = z.object({
  projectId: z.string().uuid(),
});

export const updateProjectHealthSchema = z.object({
  projectId: z.string().uuid(),
  healthState: z.enum(healthValues),
  note: z.string().max(500).optional(),
});

export const archiveProjectSchema = z.object({
  projectId: z.string().uuid(),
});

export const addProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  projectRole: z.enum(["owner", "lead", "member", "contractor"]),
});

export const removeProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  membershipId: z.string().uuid(),
});

export const createMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  parentMilestoneId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  sequence: z.number().int().default(0),
  isBlocking: z.boolean().default(false),
  dueDate: z.string().optional(),
});

export const updateMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  projectId: z.string().uuid(),
  parentMilestoneId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "blocked", "skipped"]).optional(),
  ownerId: z.string().uuid().optional(),
  sequence: z.number().int().optional(),
  isBlocking: z.boolean().optional(),
  dueDate: z.string().optional(),
});

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(priorityValues).default("normal"),
  assigneeUserId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

/** Hard ceiling on a single approved batch (prompt: batch task import) -- never unlimited AI-created rows. More than this must be split into multiple reviewed batches. */
export const MAX_BATCH_TASK_COUNT = 50;

export const createTasksBatchSchema = z.object({
  projectId: z.string().uuid(),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        milestoneId: z.string().uuid().optional(),
        priority: z.enum(priorityValues).default("normal"),
        dueDate: z.string().optional(),
      })
    )
    .min(1)
    .max(MAX_BATCH_TASK_COUNT),
});

export const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  priority: z.enum(priorityValues).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: z.string().optional(),
});

/** Narrow assignee-self-service path -- status/completed_at only (section 12). */
export const updateTaskStatusSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(["todo", "in_progress", "done", "blocked"]),
});

export const createDeliverableSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  deliverableType: z.string().min(1).max(100),
  isRequired: z.boolean().default(true),
  version: z.string().max(50).optional(),
  dueDate: z.string().optional(),
  referenceUrl: z.string().url().max(2000).optional(),
  referenceNote: z.string().max(500).optional(),
  notes: z.string().optional(),
});

export const updateDeliverableSchema = z.object({
  deliverableId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["in_progress", "internal_review", "client_review", "approved", "rejected"]).optional(),
  version: z.string().max(50).optional(),
  dueDate: z.string().optional(),
  referenceUrl: z.string().url().max(2000).optional(),
  referenceNote: z.string().max(500).optional(),
  notes: z.string().optional(),
});

export const approveDeliverableSchema = z.object({
  deliverableId: z.string().uuid(),
  projectId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export const recordDeliverySchema = z.object({
  deliverableId: z.string().uuid(),
  projectId: z.string().uuid(),
  version: z.string().max(50).optional(),
  destination: z.string().max(200).optional(),
  referenceUrl: z.string().url().max(2000).optional(),
  notes: z.string().optional(),
});

export const createScopeChangeSchema = z.object({
  projectId: z.string().uuid(),
  summary: z.string().min(1),
  reason: z.string().optional(),
  impactSummary: z.string().optional(),
  isBlocking: z.boolean().default(false),
});

export const approveScopeChangeSchema = z.object({
  scopeChangeId: z.string().uuid(),
  projectId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export const createReadinessCheckSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  isRequired: z.boolean().default(true),
  sequence: z.number().int().default(0),
});

export const completeReadinessCheckSchema = z.object({
  checkId: z.string().uuid(),
  projectId: z.string().uuid(),
  decision: z.enum(["complete", "skipped"]),
  evidenceNote: z.string().max(1000).optional(),
});

export const linkDecisionToProjectSchema = z.object({
  projectId: z.string().uuid(),
  decisionId: z.string().uuid(),
});

export const unlinkDecisionFromProjectSchema = z.object({
  projectId: z.string().uuid(),
  decisionId: z.string().uuid(),
});
