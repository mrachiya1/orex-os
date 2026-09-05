import { z } from "zod";
import { candidateFactItemTypes, knowledgeDomains } from "@/lib/ai/schemas/knowledge";

const classifications = ["public", "internal", "confidential", "restricted", "secret"] as const;

export const createKnowledgeItemSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  domain: z.enum(knowledgeDomains),
  itemType: z.enum(candidateFactItemTypes),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  classification: z.enum(classifications).default("internal"),
  markVerified: z.boolean().default(false),
});

export const updateKnowledgeItemSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  classification: z.enum(classifications).optional(),
});

export const verifyKnowledgeItemSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  decision: z.enum(["verified", "rejected"]),
});

export const supersedeKnowledgeItemSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  organisationId: z.string().uuid(),
  domain: z.enum(knowledgeDomains),
  itemType: z.enum(candidateFactItemTypes),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  classification: z.enum(classifications).default("internal"),
});

export const archiveKnowledgeItemSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
});

export const extractCandidatesSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  domain: z.enum(knowledgeDomains),
  classification: z.enum(classifications).default("internal"),
  pastedText: z.string().min(1).max(20000),
});

export const askCompanyBrainSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  question: z.string().min(1).max(2000),
});
