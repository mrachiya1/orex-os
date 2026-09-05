import { z } from "zod";

export const createDecisionSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  situation: z.string().min(1),
  evidence: z.array(z.string()).default([]),
  options: z.array(z.string()).default([]),
  aiRecommendation: z.string().optional(),
  chosenAction: z.string().optional(),
  expectedResult: z.string().optional(),
  decisionDate: z.string().optional(),
  reviewDate: z.string().optional(),
  relatedKnowledgeItemId: z.string().uuid().optional(),
});

export const updateDecisionSchema = z.object({
  decisionId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  status: z.enum(["proposed", "decided", "in_review", "closed"]).optional(),
  chosenAction: z.string().optional(),
  expectedResult: z.string().optional(),
  decisionDate: z.string().optional(),
  reviewDate: z.string().optional(),
});

export const reviewDecisionSchema = z.object({
  decisionId: z.string().uuid(),
  companyId: z.string().uuid().nullable(),
  actualResult: z.string().min(1),
  lesson: z.string().optional(),
});
