import { z } from "zod";

/**
 * Structured output schema for the knowledge.extract task alias
 * (prompts/003-company-brain.md section 11 "Knowledge Ingestion"). Every
 * candidate this schema validates is inserted with origin_type:
 * "ai_extracted", verification_status: "candidate" -- never "verified" --
 * enforced separately by app/actions/knowledge.ts and the database
 * constraint knowledge_items_ai_never_preverified.
 */
export const candidateFactItemTypes = [
  "fact",
  "document",
  "vision",
  "mission",
  "goal",
  "service",
  "strategy",
  "rule",
  "policy",
  "process",
  "sop",
  "lesson",
  "win",
  "failure",
  "research",
] as const;

export const knowledgeDomains = [
  "identity",
  "business",
  "strategy",
  "goals",
  "operations",
  "sales",
  "knowledge",
] as const;

export const candidateFactSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  domain: z.enum(knowledgeDomains),
  itemType: z.enum(candidateFactItemTypes),
  confidence: z.number().min(0).max(1),
});

export const extractCandidateFactsSchema = z.object({
  candidates: z.array(candidateFactSchema).max(20),
});

export type CandidateFact = z.infer<typeof candidateFactSchema>;
export type ExtractCandidateFactsResult = z.infer<typeof extractCandidateFactsSchema>;

/**
 * Structured output schema for the minimal read-only Company Brain Q&A
 * capability (prompts/003-company-brain.md section 17). The answer is
 * always rendered with its cited sources -- never as unattributed prose.
 */
export const advisorAnswerSchema = z.object({
  answer: z.string().min(1),
  citedSources: z.array(
    z.object({
      knowledgeItemId: z.string().uuid(),
      title: z.string(),
    })
  ),
});

export type AdvisorAnswer = z.infer<typeof advisorAnswerSchema>;
