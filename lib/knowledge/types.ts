export type KnowledgeDomain =
  | "identity"
  | "business"
  | "strategy"
  | "goals"
  | "operations"
  | "sales"
  | "knowledge";

export type KnowledgeItemType =
  | "fact"
  | "document"
  | "vision"
  | "mission"
  | "goal"
  | "service"
  | "strategy"
  | "rule"
  | "policy"
  | "process"
  | "sop"
  | "lesson"
  | "win"
  | "failure"
  | "research";

export type KnowledgeOriginType = "human" | "ai_extracted" | "system";
export type KnowledgeVerificationStatus = "candidate" | "verified" | "rejected";
export type KnowledgeLifecycleStatus = "current" | "stale" | "superseded" | "archived";

export type KnowledgeClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted"
  | "secret";

export interface KnowledgeChunkMetadata {
  knowledgeItemId: string;
  sourceId: string;
  companyId: string | null;
  chunkIndex: number;
  sectionTitle: string | null;
  classification: KnowledgeClassification;
  verificationStatus: KnowledgeVerificationStatus;
  embeddingModel: string | null;
  embeddingDimension: number | null;
  embeddedAt: string | null;
}

export interface RetrievedKnowledge {
  knowledgeItemId: string;
  content: string;
  title: string;
  domain: KnowledgeDomain;
  itemType: KnowledgeItemType;
  companyId: string | null;
  sourceLabel: string | null;
  verificationStatus: KnowledgeVerificationStatus;
  lifecycleStatus: KnowledgeLifecycleStatus;
  classification: KnowledgeClassification;
  confidence: number | null;
  similarity: number;
}
