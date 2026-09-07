/**
 * Client value derivation (prompts/017-clients-intelligence-v1.md, founder
 * decision 3). Reads real project_value_minor/currency_code from linked
 * projects -- never fabricates a number, never sums across currencies, never
 * invents an FX rate. A project with no value data is excluded from every
 * total (not treated as zero). A client whose linked projects carry no
 * value data at all should render "Not tracked" -- callers check
 * totalsByCurrency.length === 0.
 */

const ACTIVE_STATUSES = new Set(["draft", "planned", "active", "on_hold", "review", "delivery_ready"]);
const COMPLETED_STATUSES = new Set(["delivered", "completed"]);

export interface ProjectValueRow {
  status: string;
  projectValueMinor: number | null;
  currencyCode: string | null;
}

export interface CurrencyTotal {
  currencyCode: string;
  lifetimeMinor: number;
  activeMinor: number;
  completedMinor: number;
  projectCountWithValue: number;
}

export interface ClientValueSummary {
  totalsByCurrency: CurrencyTotal[];
  projectCount: number;
  activeProjectCount: number;
  completedProjectCount: number;
}

export function computeClientValue(projects: ProjectValueRow[]): ClientValueSummary {
  const byCurrency = new Map<string, CurrencyTotal>();
  let activeProjectCount = 0;
  let completedProjectCount = 0;

  for (const p of projects) {
    const isActive = ACTIVE_STATUSES.has(p.status);
    const isCompleted = COMPLETED_STATUSES.has(p.status);
    if (isActive) activeProjectCount += 1;
    if (isCompleted) completedProjectCount += 1;

    if (p.projectValueMinor == null || !p.currencyCode) continue;

    let entry = byCurrency.get(p.currencyCode);
    if (!entry) {
      entry = { currencyCode: p.currencyCode, lifetimeMinor: 0, activeMinor: 0, completedMinor: 0, projectCountWithValue: 0 };
      byCurrency.set(p.currencyCode, entry);
    }
    entry.lifetimeMinor += p.projectValueMinor;
    entry.projectCountWithValue += 1;
    if (isActive) entry.activeMinor += p.projectValueMinor;
    if (isCompleted) entry.completedMinor += p.projectValueMinor;
  }

  return {
    totalsByCurrency: Array.from(byCurrency.values()).sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)),
    projectCount: projects.length,
    activeProjectCount,
    completedProjectCount,
  };
}

export function averageValueMinor(total: CurrencyTotal): number {
  return total.projectCountWithValue > 0 ? Math.round(total.lifetimeMinor / total.projectCountWithValue) : 0;
}
