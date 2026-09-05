import "server-only";
import type { KnowledgeItemType } from "./types";

/**
 * Semantic-structure-first chunking (prompts/003-company-brain.md section
 * 12, founder decision #5) -- never arbitrary fixed-size token slicing.
 *
 *   Atomic facts:            never chunked (one chunk, verbatim).
 *   SOPs / processes:        split by logical process step where detected.
 *   Everything else:         paragraph/heading-boundary grouping targeting
 *                             ~450-650 tokens per chunk, ~75 tokens of
 *                             overlap where a chunk boundary falls inside
 *                             what would otherwise be one contiguous idea.
 *
 * Token counts are estimated at ~4 characters per token (a standard rough
 * heuristic) since this module has no tokenizer dependency -- precise
 * enough for chunk-size targeting, not used for any billing/usage purpose
 * (actual token counts for AI calls always come from the provider's own
 * usage metadata, per lib/ai/usage.ts).
 */

const CHARS_PER_TOKEN = 4;
const TARGET_MIN_TOKENS = 450;
const TARGET_MAX_TOKENS = 650;
const OVERLAP_TOKENS = 75;

const TARGET_MIN_CHARS = TARGET_MIN_TOKENS * CHARS_PER_TOKEN;
const TARGET_MAX_CHARS = TARGET_MAX_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

export interface KnowledgeChunkDraft {
  chunkIndex: number;
  content: string;
  sectionTitle: string | null;
}

const STEP_MARKER = /^(?:\s*(?:step\s*\d+[:.)-]?|\d+[.)]))\s*/im;

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitBySteps(content: string): string[] | null {
  const lines = content.split(/\n/);
  const stepStartIndexes: number[] = [];
  lines.forEach((line, idx) => {
    if (STEP_MARKER.test(line)) stepStartIndexes.push(idx);
  });
  if (stepStartIndexes.length < 2) return null;

  const steps: string[] = [];
  for (let i = 0; i < stepStartIndexes.length; i++) {
    const start = stepStartIndexes[i];
    const end = i + 1 < stepStartIndexes.length ? stepStartIndexes[i + 1] : lines.length;
    const stepText = lines.slice(start, end).join("\n").trim();
    if (stepText) steps.push(stepText);
  }
  return steps.length > 0 ? steps : null;
}

function extractSectionTitle(block: string): string | null {
  const headingMatch = block.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const stepMatch = block.match(STEP_MARKER);
  if (stepMatch) return block.slice(0, Math.min(60, block.length)).split("\n")[0].trim();
  return null;
}

function groupIntoChunks(blocks: string[]): KnowledgeChunkDraft[] {
  const chunks: KnowledgeChunkDraft[] = [];
  let current = "";

  const flush = () => {
    if (current.trim().length === 0) return;
    chunks.push({
      chunkIndex: chunks.length,
      content: current.trim(),
      sectionTitle: extractSectionTitle(current),
    });
  };

  for (const block of blocks) {
    // A single block longer than the max target is hard-split with overlap
    // so no chunk vastly exceeds the target range.
    if (block.length > TARGET_MAX_CHARS) {
      flush();
      current = "";
      let start = 0;
      while (start < block.length) {
        const end = Math.min(start + TARGET_MAX_CHARS, block.length);
        const slice = block.slice(start, end);
        chunks.push({
          chunkIndex: chunks.length,
          content: slice.trim(),
          sectionTitle: extractSectionTitle(slice),
        });
        if (end >= block.length) break;
        start = end - OVERLAP_CHARS;
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > TARGET_MAX_CHARS && current.length >= TARGET_MIN_CHARS) {
      flush();
      // Carry a tail-overlap from the previous chunk into the next one when
      // continuity helps (the previous chunk ended mid-topic).
      const overlapTail = current.slice(Math.max(0, current.length - OVERLAP_CHARS));
      current = `${overlapTail}\n\n${block}`.trim();
    } else {
      current = candidate;
    }
  }
  flush();

  return chunks;
}

/**
 * Splits a knowledge_items row's content into knowledge_chunks rows. Every
 * item gets at least one chunk regardless of item_type, so retrieval has a
 * single code path.
 */
export function chunkKnowledgeContent(
  itemType: KnowledgeItemType,
  content: string
): KnowledgeChunkDraft[] {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return [{ chunkIndex: 0, content: "", sectionTitle: null }];
  }

  if (itemType === "fact") {
    return [{ chunkIndex: 0, content: trimmed, sectionTitle: null }];
  }

  if (itemType === "sop" || itemType === "process") {
    const steps = splitBySteps(trimmed);
    if (steps) {
      // One chunk per logical process step -- a structural boundary, not a
      // size target, so short steps are deliberately NOT merged together
      // (unlike the generic paragraph-grouping path below). A step longer
      // than the max target is still hard-split with overlap.
      return steps.flatMap((step) => {
        if (step.length <= TARGET_MAX_CHARS) {
          return [{ chunkIndex: -1, content: step, sectionTitle: extractSectionTitle(step) }];
        }
        const subChunks: KnowledgeChunkDraft[] = [];
        let start = 0;
        while (start < step.length) {
          const end = Math.min(start + TARGET_MAX_CHARS, step.length);
          subChunks.push({ chunkIndex: -1, content: step.slice(start, end).trim(), sectionTitle: extractSectionTitle(step) });
          if (end >= step.length) break;
          start = end - OVERLAP_CHARS;
        }
        return subChunks;
      }).map((c, idx) => ({ ...c, chunkIndex: idx }));
    }
  }

  const paragraphs = splitParagraphs(trimmed);
  if (paragraphs.length === 0) {
    return [{ chunkIndex: 0, content: trimmed, sectionTitle: null }];
  }

  return groupIntoChunks(paragraphs);
}
