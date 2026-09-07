/**
 * Deterministic, explainable Client Relationship Health (prompts/017-
 * clients-intelligence-v1.md section 4). No AI call, no stored score
 * column -- a pure function over real signals already in the data model,
 * computed at read time. Every status renders with a "Why" list of the
 * actual triggering facts, never a bare number.
 */

export type ClientHealthStatus = "strong" | "healthy" | "attention" | "at_risk" | "unknown";

export interface ClientHealthInput {
  openIssuesCount: number;
  hasLinkedProjects: boolean;
  hasActiveProject: boolean;
  hasAtRiskProject: boolean;
  hasBlockedProject: boolean;
  /** null = no recorded interaction yet. */
  daysSinceLastInteraction: number | null;
}

export interface ClientHealthResult {
  status: ClientHealthStatus;
  reasons: string[];
}

export const CLIENT_HEALTH_LABELS: Record<ClientHealthStatus, string> = {
  strong: "Strong",
  healthy: "Healthy",
  attention: "Attention",
  at_risk: "At Risk",
  unknown: "Unknown",
};

export function computeClientHealth(input: ClientHealthInput): ClientHealthResult {
  const {
    openIssuesCount,
    hasLinkedProjects,
    hasActiveProject,
    hasAtRiskProject,
    hasBlockedProject,
    daysSinceLastInteraction,
  } = input;

  if (!hasLinkedProjects && daysSinceLastInteraction === null) {
    return { status: "unknown", reasons: ["No linked projects or recorded interactions yet"] };
  }

  const reasons: string[] = [];
  if (openIssuesCount === 1) reasons.push("1 open relationship issue");
  if (openIssuesCount >= 2) reasons.push(`${openIssuesCount} open relationship issues`);
  if (hasBlockedProject) reasons.push("A linked project is blocked");
  if (hasAtRiskProject) reasons.push("A linked project is at risk");
  if (daysSinceLastInteraction !== null && daysSinceLastInteraction > 21) {
    reasons.push(`No interaction for ${daysSinceLastInteraction} days`);
  } else if (daysSinceLastInteraction !== null && daysSinceLastInteraction >= 8) {
    reasons.push(`Last interaction ${daysSinceLastInteraction} days ago`);
  }

  const staleWithActiveProject =
    daysSinceLastInteraction !== null && daysSinceLastInteraction > 21 && hasActiveProject;

  // At Risk is checked first -- it always overrides Strong/Healthy, even if
  // the interaction recency would otherwise look fine.
  if (openIssuesCount >= 2 || hasBlockedProject || staleWithActiveProject) {
    return { status: "at_risk", reasons };
  }

  if (
    openIssuesCount === 0 &&
    hasActiveProject &&
    !hasAtRiskProject &&
    daysSinceLastInteraction !== null &&
    daysSinceLastInteraction <= 7
  ) {
    return { status: "strong", reasons: ["No open issues", "Recently interacted", "Active project on track"] };
  }

  if (
    openIssuesCount === 0 &&
    !hasAtRiskProject &&
    daysSinceLastInteraction !== null &&
    daysSinceLastInteraction <= 14
  ) {
    return { status: "healthy", reasons: ["No open issues", "Recent interaction"] };
  }

  // Everything else with linked projects/interaction history: exactly 1
  // open issue, an at-risk (not blocked) project, a 15-21 day interaction
  // gap, or stale/absent interaction data -- a conservative middle status
  // rather than assuming Healthy without recent evidence.
  return { status: "attention", reasons: reasons.length ? reasons : ["Insufficient recent interaction data"] };
}
