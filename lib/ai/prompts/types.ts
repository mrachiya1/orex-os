/**
 * Prompt-versioning shape per docs/ai/prompt-versioning.md. Phase 002 ships
 * only this type and the file-organisation pattern
 * (lib/ai/prompts/<alias>/v1.ts) -- no real prompt content, since no real
 * task alias is wired to a feature yet.
 */
export interface PromptVersionMetadata {
  promptId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  status: "draft" | "active" | "deprecated";
  modelCompatibility: string[];
  changeReason: string;
}

export interface PromptVersion extends PromptVersionMetadata {
  template: string;
}
