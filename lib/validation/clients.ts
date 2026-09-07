import { z } from "zod";
import { isSupportedCurrencyCode } from "@/lib/finance/currency";

const statusValues = ["lead", "negotiating", "active", "paused", "inactive", "completed", "lost"] as const;
const relationshipStageValues = ["new", "developing", "established", "long_term", "at_risk", "dormant"] as const;
const preferenceCategoryValues = ["communication", "creative", "delivery", "process", "meeting", "presentation", "general"] as const;
const preferenceSentimentValues = ["like", "dislike", "preference", "avoid"] as const;
const preferenceOriginValues = ["human", "client_direct", "project", "meeting", "ai"] as const;
const feedbackSentimentValues = ["positive", "neutral", "negative"] as const;
const feedbackTypeValues = [
  "positive", "neutral", "concern", "disappointment", "misunderstanding",
  "scope_issue", "communication_issue", "delivery_issue",
] as const;
const issueTypeValues = ["misunderstanding", "scope_conflict", "communication_delay", "delivery_concern", "payment_concern"] as const;
const issueSeverityValues = ["low", "medium", "high"] as const;
const noteTypeValues = ["general", "communication", "preference", "request", "concern", "relationship_update"] as const;
const credentialTypeValues = ["website_login", "hosting", "social_media", "server", "dns", "email", "other"] as const;

export const createClientSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  status: z.enum(statusValues).default("lead"),
  relationshipStage: z.enum(relationshipStageValues).default("new"),
  website: z.string().max(300).optional(),
  industry: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  timezone: z.string().max(80).optional(),
  source: z.string().max(200).optional(),
  howWeMet: z.string().max(500).optional(),
  clientSince: z.string().optional(),
});

export const updateClientSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).nullable().optional(),
  status: z.enum(statusValues).optional(),
  relationshipStage: z.enum(relationshipStageValues).optional(),
  website: z.string().max(300).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  timezone: z.string().max(80).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  howWeMet: z.string().max(500).nullable().optional(),
  clientSince: z.string().nullable().optional(),
  notesSummary: z.string().max(2000).nullable().optional(),
});

export const archiveClientSchema = z.object({
  clientId: z.string().uuid(),
});

export const createContactSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().max(120).optional(),
  preferredName: z.string().max(120).optional(),
  jobTitle: z.string().max(150).optional(),
  businessEmail: z.string().email().max(200).optional(),
  businessPhone: z.string().max(60).optional(),
  timezone: z.string().max(80).optional(),
  country: z.string().max(120).optional(),
  isPrimaryContact: z.boolean().default(false),
});

export const updateContactPrivateSchema = z.object({
  contactId: z.string().uuid(),
  birthday: z.string().nullable().optional(),
  personalEmail: z.string().email().max(200).nullable().optional(),
  personalPhone: z.string().max(60).nullable().optional(),
  privateNotes: z.string().max(2000).nullable().optional(),
});

export const createBrandSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  website: z.string().max(300).optional(),
  category: z.string().max(150).optional(),
  description: z.string().max(1000).optional(),
});

export const linkProjectToClientSchema = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid().nullable(),
  clientBrandId: z.string().uuid().nullable().optional(),
  primaryClientContactId: z.string().uuid().nullable().optional(),
});

/** Founder decision 3: value and currency must be set/cleared together -- DB only enforces shape. */
export const updateProjectValueSchema = z
  .object({
    projectId: z.string().uuid(),
    projectValueMinor: z.number().int().min(0).nullable(),
    currencyCode: z.string().length(3).nullable(),
  })
  .refine((v) => (v.projectValueMinor === null) === (v.currencyCode === null), {
    message: "projectValueMinor and currencyCode must both be set or both be null",
    path: ["currencyCode"],
  })
  .refine((v) => v.currencyCode === null || isSupportedCurrencyCode(v.currencyCode), {
    message: "Unsupported currency code",
    path: ["currencyCode"],
  });

export const createNoteSchema = z.object({
  clientId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  type: z.enum(noteTypeValues).default("general"),
  content: z.string().min(1).max(4000),
  source: z.string().max(200).optional(),
});

export const createPreferenceSchema = z.object({
  clientId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  category: z.enum(preferenceCategoryValues).default("general"),
  statement: z.string().min(1).max(500),
  sentiment: z.enum(preferenceSentimentValues),
  origin: z.enum(preferenceOriginValues),
  sourceReference: z.string().max(500).optional(),
});

export const verifyPreferenceSchema = z.object({
  preferenceId: z.string().uuid(),
});

export const createFeedbackSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  sentiment: z.enum(feedbackSentimentValues),
  feedbackType: z.enum(feedbackTypeValues).default("positive"),
  content: z.string().min(1).max(4000),
  receivedAt: z.string().optional(),
  source: z.string().max(200).optional(),
});

export const createIssueSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  type: z.enum(issueTypeValues),
  severity: z.enum(issueSeverityValues).default("medium"),
  reason: z.string().min(1).max(2000),
  impact: z.string().max(2000).optional(),
  occurredAt: z.string().optional(),
});

export const resolveIssueSchema = z.object({
  issueId: z.string().uuid(),
  resolution: z.string().min(1).max(2000),
  lesson: z.string().max(2000).optional(),
});

export const createCredentialSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  label: z.string().min(1).max(200),
  credentialType: z.enum(credentialTypeValues),
  provider: z.string().max(150).optional(),
  usernameHint: z.string().max(150).optional(),
});
