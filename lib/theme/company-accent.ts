/**
 * Maps a company's `accent_color_key` (companies.accent_color_key) to its
 * narrow UI accent — switcher badge, active-nav dot, header underline only.
 * Never used to reskin an entire page (docs/design-system.md "Company
 * Accent System"). New companies get a token value here, never a component
 * fork.
 */
export const COMPANY_ACCENT: Record<string, string> = {
  neutral: "var(--company-group)",
  orextic: "var(--company-orextic)",
  "orex-studios": "var(--company-orex-studios)",
};

export function companyAccent(accentColorKey: string | null | undefined): string {
  return COMPANY_ACCENT[accentColorKey ?? "neutral"] ?? COMPANY_ACCENT.neutral;
}
