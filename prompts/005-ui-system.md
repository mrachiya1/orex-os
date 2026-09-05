# UI System Pass — Approved Premium Dark Shell

## Status

IMPLEMENTED (2026-09-05). The founder supplied an exhaustive, fully-specified visual direction (reference: Founder Dashboard mock) with explicit "this is now the approved visual direction... implement it into the actual product" authorization — treated as the approval gate per AGENTS.md, matching the precedent set by Phase 004.5's kickoff. This document records the implementation decisions made along the way, not a separate approval round.

## What this pass touched

Design tokens (`app/globals.css`), typography (`app/layout.tsx` — added Fraunces), new shared primitives (`components/ui/*`), the app shell (`components/shell/Sidebar.tsx`, `app/(app)/layout.tsx`, `app/(app)/[companySlug]/layout.tsx`), the Today dashboard (new — `app/(app)/[companySlug]/page.tsx`), and a visual-only restyle of Team, Projects (list + detail tab shell), Delivery Ready, Company Brain (overview), and Audit.

No database schema, RLS policy, permission, server action business logic, or AI gateway code changed. Two tiny compatibility adjustments were required and are listed below.

## Decisions made without a separate round-trip

1. **Today is company-scoped, not an org-wide aggregate.** The reference mock shows an "Orex Group" rollup across companies. No cross-company aggregate query path exists in the current data model (every operational table is `company_id`-scoped), and building one is a backend decision, not a UI one. Today therefore shows the active company's real data — honest within the existing architecture, per AGENTS.md "stop and report if a backend architecture change appears necessary" rather than quietly building a fake rollup.
2. **Dark-only, no light mode.** The founder's brief says "the interface should feel 90% black... this design is now the approved visual direction" — treated as a committed product identity, not a togglable theme, so `color-scheme: dark` is painted unconditionally rather than gated behind `prefers-color-scheme`.
3. **No icon package installed.** `docs/design-system.md` only "recommended" `lucide-react` "when approved" — never installed. Rather than add a new dependency as a side effect of a UI pass, this pass hand-authored one consistent outline SVG set (`components/ui/icons.tsx`, 1.6px stroke, sized to text). Swapping to a package later is a one-file change if the founder wants it.
4. **Invite Member / New Project moved into a `Modal`**, per the founder's explicit instruction that these "should preferably open in a modal/drawer rather than permanently occupying the page header." A minimal centered-dialog component was built rather than pulling in a dialog library for one use.
5. **Deep project sub-pages were not individually rebuilt.** Per the founder's explicit sequencing instruction ("do not redesign every deep project sub-page before the shell works"), Milestones/Tasks/Deliverables/Readiness/Scope/Team/Decisions tables and forms keep their original markup. They inherit the new palette automatically because every pre-existing component already read `var(--border)`/`var(--muted)`/`var(--surface)`/`var(--accent)` — this pass upgraded those token *values* and kept the names as aliases so nothing needed a per-file edit to look right, even though it hasn't been restructured onto the new `.ox-table`/`Card` primitives yet.

## Compatibility adjustments (not business-logic changes)

- `getCompanyBySlug` now also selects `accent_color_key` (needed by the sidebar's company switcher dot) — additive select, no schema change.
- The app-level auth gate moved from `app/(app)/layout.tsx` down to `app/(app)/[companySlug]/layout.tsx` (the shell needs the company slug to build company-scoped nav links). `app/(app)/layout.tsx` is now a pure auth redirect with no UI. Route protection behavior is unchanged — every route under `(app)` still requires a session before rendering.
- Two post-accept/root redirects changed target from `/{slug}/team` to `/{slug}` (Today), since Today is now the real landing page instead of a redirect stub.

## Explicitly not done (flag, not silently skipped)

- Phase 001's `0009_harden_function_grants.sql` PUBLIC-grant gap (recorded in `docs/design-system.md` and previously in the Phase 004.5 report) remains unfixed — unrelated to this UI pass, still open for the founder's attention.
- No AI call was added anywhere in this pass (AI Suggestions panel is a static inactive state, not a stub that calls OpenRouter).
