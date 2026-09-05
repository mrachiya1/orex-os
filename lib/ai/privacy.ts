import "server-only";
import type { DataClassification } from "./redaction";
import { AIGatewayError } from "./errors";

/**
 * OpenRouter provider-routing preferences, shaped to match
 * @openrouter/sdk's ProviderPreferences type (dataCollection/zdr/
 * requireParameters) without importing the SDK type here, so this module
 * stays a plain, easily-unit-testable function.
 */
export interface ProviderRoutingPreferences {
  dataCollection?: "deny" | "allow";
  zdr?: boolean;
  requireParameters?: boolean;
}

/**
 * Implements the founder-approved Phase 002 privacy routing decision:
 *
 *   Public / Internal   -> normal approved routing (no constraint)
 *   Confidential        -> deny data-collection providers, strongest
 *                          practical privacy routing
 *   Restricted          -> require ZDR routing (task-level allowlisting is
 *                          enforced separately, by lib/ai/redaction.ts --
 *                          this function only handles provider routing)
 *   Secret              -> must never reach OpenRouter at all; calling this
 *                          function with "secret" is itself a bug and it
 *                          throws rather than returning any routing config.
 *
 * "Do not silently relax a privacy requirement merely because no provider
 * is available. Fail safely instead" is satisfied by construction: these
 * preferences are passed straight to OpenRouter, whose own API returns an
 * error if no provider satisfies them (see @openrouter/sdk's
 * ProviderPreferences.dataCollection/.zdr doc comments) -- lib/ai/router.ts
 * propagates that as a PRIVACY_POLICY_REJECTED error, never retries without
 * the constraint.
 */
export function buildProviderPreferences(
  classification: DataClassification
): ProviderRoutingPreferences | undefined {
  switch (classification) {
    case "public":
    case "internal":
      return undefined;
    case "confidential":
      return { dataCollection: "deny", requireParameters: true };
    case "restricted":
      return { dataCollection: "deny", zdr: true, requireParameters: true };
    case "secret":
      throw new AIGatewayError(
        "PRIVACY_POLICY_REJECTED",
        "Secret-classified data must never be routed to an AI provider."
      );
  }
}
