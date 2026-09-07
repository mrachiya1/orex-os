export type ClientStatus = "lead" | "negotiating" | "active" | "paused" | "inactive" | "completed" | "lost";
export type RelationshipStage = "new" | "developing" | "established" | "long_term" | "at_risk" | "dormant";
export type PreferenceCategory = "communication" | "creative" | "delivery" | "process" | "meeting" | "presentation" | "general";
export type PreferenceSentiment = "like" | "dislike" | "preference" | "avoid";
export type PreferenceOrigin = "human" | "client_direct" | "project" | "meeting" | "ai";
export type PreferenceKnowledgeType = "verified" | "observed" | "inference";
export type FeedbackSentiment = "positive" | "neutral" | "negative";
export type FeedbackType =
  | "positive"
  | "neutral"
  | "concern"
  | "disappointment"
  | "misunderstanding"
  | "scope_issue"
  | "communication_issue"
  | "delivery_issue";
export type RelationshipIssueType =
  | "misunderstanding"
  | "scope_conflict"
  | "communication_delay"
  | "delivery_concern"
  | "payment_concern";
export type RelationshipIssueSeverity = "low" | "medium" | "high";
export type RelationshipIssueStatus = "open" | "resolved";
export type ClientNoteType = "general" | "communication" | "preference" | "request" | "concern" | "relationship_update";
export type CredentialType = "website_login" | "hosting" | "social_media" | "server" | "dns" | "email" | "other";
