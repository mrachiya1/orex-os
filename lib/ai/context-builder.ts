import "server-only";
import {
  redactContext,
  highestClassification,
  type ClassifiedField,
  type DataClassification,
} from "./redaction";
import { AIGatewayError } from "./errors";

export interface BuildContextParams {
  fields: ClassifiedField[];
  allowConfidential: boolean;
  allowRestricted: boolean;
}

export interface BuiltContext {
  redacted: Record<string, unknown>;
  /** Highest classification actually surviving redaction -- drives provider privacy routing. */
  classification: DataClassification;
}

/**
 * Generic context-assembly pipeline (docs/ai/context-policy.md "Context
 * Builder Pipeline"). Phase 002 has no real operational modules to query
 * yet, so callers supply already-classified fields directly (a synthetic/
 * test-fixture path, and the same shape a future phase's real per-task
 * query would produce) -- this function's job is the redaction/
 * classification/fail-closed logic, not the querying itself.
 */
export function buildContext(params: BuildContextParams): BuiltContext {
  // Fail closed if a Secret-classified field was ever assembled in the
  // first place -- this should never happen (no query should select a
  // secret column), so its presence indicates an upstream bug, not a
  // normal redaction case. See docs/ai/context-policy.md "Failure Behavior".
  if (params.fields.some((f) => f.classification === "secret")) {
    throw new AIGatewayError(
      "CONTEXT_CONSTRUCTION_FAILED",
      "Context assembly attempted to include Secret-classified data."
    );
  }

  const redacted = redactContext(params.fields, {
    allowConfidential: params.allowConfidential,
    allowRestricted: params.allowRestricted,
  });

  const survivingFields = params.fields.filter((f) => Object.prototype.hasOwnProperty.call(redacted, f.key));
  const classification = highestClassification(
    survivingFields.length > 0 ? survivingFields : [{ classification: "public" }]
  );

  return { redacted, classification };
}
