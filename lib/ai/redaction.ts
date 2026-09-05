import "server-only";
import { redactSecrets } from "@/lib/audit/redaction";

/**
 * The five Orex OS data-sensitivity classifications, per docs/product-scope.md
 * and docs/ai/context-policy.md.
 */
export type DataClassification = "public" | "internal" | "confidential" | "restricted" | "secret";

/**
 * Shared ordering for every classification comparison in lib/ai -- exported
 * so lib/ai/sensitivity.ts can compare a task's sensitivityAllowance against
 * a request's classification without re-declaring this order (and risking
 * the two lists drifting apart).
 */
export const CLASSIFICATION_ORDER: DataClassification[] = [
  "public",
  "internal",
  "confidential",
  "restricted",
  "secret",
];

export interface ClassifiedField {
  key: string;
  value: unknown;
  classification: DataClassification;
}

export interface RedactionOptions {
  /** Task explicitly allows Confidential-classified fields through. */
  allowConfidential: boolean;
  /** Task explicitly allows Restricted-classified fields through. */
  allowRestricted: boolean;
}

/**
 * Two-pass context redaction (docs/ai/context-policy.md "Redaction
 * Pipeline"):
 *   1. Unconditional secret-key-pattern strip (shared with lib/audit).
 *   2. Classification-based strip: Secret never allowed through this
 *      function at all (callers must never pass a "secret" field in);
 *      Restricted/Confidential removed unless explicitly allowlisted by
 *      the calling task.
 */
export function redactContext(
  fields: ClassifiedField[],
  options: RedactionOptions
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.classification === "secret") {
      // Defense in depth: a context builder should never produce a Secret
      // field to begin with. If one arrives here anyway, it is dropped,
      // never included, regardless of any allowlist.
      continue;
    }
    if (field.classification === "restricted" && !options.allowRestricted) {
      continue;
    }
    if (field.classification === "confidential" && !options.allowConfidential) {
      continue;
    }
    result[field.key] = redactSecrets(field.value);
  }

  return result;
}

/**
 * The highest classification present in a set of fields that actually
 * survived redact filtering -- used to decide which OpenRouter provider
 * privacy controls (docs/ai/openrouter-architecture.md) the request needs.
 * Secret is never included here (redactContext never lets it through), but
 * is accepted as an input value so a caller can still detect "context
 * construction tried to include Secret data" and fail closed before ever
 * reaching the provider-preference stage.
 */
export function highestClassification(
  fields: Array<{ classification: DataClassification }>
): DataClassification {
  let highest: DataClassification = "public";
  for (const field of fields) {
    if (CLASSIFICATION_ORDER.indexOf(field.classification) > CLASSIFICATION_ORDER.indexOf(highest)) {
      highest = field.classification;
    }
  }
  return highest;
}
