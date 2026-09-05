import "server-only";
import { CLASSIFICATION_ORDER, type DataClassification } from "./redaction";
import type { SensitivityAllowance } from "./model-registry";
import { AIGatewayError } from "./errors";

/**
 * The single enforcement point for a task alias's sensitivityAllowance
 * (lib/ai/model-registry.ts), called once from lib/ai/router.ts before any
 * provider-privacy routing or network call is made -- see
 * prompts/003-company-brain.md's Phase 003 hardening pass. This is
 * deliberately separate from lib/ai/privacy.ts: privacy.ts decides HOW to
 * route a request to OpenRouter for a given classification; this module
 * decides WHETHER the task is allowed to run for that classification at
 * all. Both checks must pass -- neither substitutes for the other.
 *
 * Never duplicate this ordering logic elsewhere -- every classification
 * comparison in lib/ai reuses CLASSIFICATION_ORDER from ./redaction.
 */
const ALLOWANCE_MAX_CLASSIFICATION: Record<SensitivityAllowance, DataClassification> = {
  public_internal: "internal",
  confidential: "confidential",
  restricted: "restricted",
};

/**
 * Throws AIGatewayError("TASK_SENSITIVITY_REJECTED", ...) if the given
 * classification exceeds what the task alias is allowed to process.
 * Secret is rejected unconditionally, for every allowance level -- no task
 * alias may ever declare Secret as an allowed sensitivity.
 *
 * The thrown message includes only the alias name and classification
 * labels (safe metadata already known to the caller), never any request
 * content -- satisfies "no sensitive content appears in logs or audit
 * metadata" without needing a separate redaction pass here.
 */
export function assertClassificationAllowed(
  alias: string,
  allowance: SensitivityAllowance,
  classification: DataClassification
): void {
  if (classification === "secret") {
    throw new AIGatewayError(
      "TASK_SENSITIVITY_REJECTED",
      `Task "${alias}" may never process Secret-classified data.`
    );
  }

  const maxAllowed = ALLOWANCE_MAX_CLASSIFICATION[allowance];
  if (CLASSIFICATION_ORDER.indexOf(classification) > CLASSIFICATION_ORDER.indexOf(maxAllowed)) {
    throw new AIGatewayError(
      "TASK_SENSITIVITY_REJECTED",
      `Task "${alias}" does not allow ${classification}-classified data (maximum allowed: ${maxAllowed}).`
    );
  }
}
