# Orex OS Design System

## Design Principles

Premium, intelligent, dense, professional, modern, calm, precise, human, operational. Avoid generic SaaS templates, cyberpunk styling, excessive glassmorphism, random gradients, oversized dashboard cards, over-rounded playful UI, decorative charts, and visual clutter.

## Existing UI Observations

Inspected `app/globals.css`, `app/layout.tsx`, `app/page.tsx`: the repository currently ships only the unmodified `create-next-app` scaffold (Geist fonts, default light/dark `--background`/`--foreground` tokens, the stock marketing landing page). There is no existing custom design system, component library, or token set to preserve — Orex OS's visual identity starts from zero. `components/` is empty. This document defines the target system Phase 001's minimal UI (sign-in, company switcher, authenticated shell) should establish first, for later modules to build on rather than reinvent.

## Parent Orex OS Visual Identity

A neutral, dark-leaning operational interface — near-black/graphite surfaces, high-contrast but restrained typography, minimal color used only for status/accent, not decoration. The parent shell (sidebar, top bar, base surfaces) stays company-agnostic; company identity shows up only through the accent system below, applied narrowly (an active-state highlight, the company switcher badge, a header underline) — never a full-page reskin per company.

## Company Accent System

- **Orex Studios** — silver / graphite / cool neutral accent
- **Orextic** — coral / warm orange accent

Implemented as a single `--accent` CSS variable (or Tailwind theme token) set per active-company context, not as per-company component variants. Future companies get a new accent token value, never a new component fork.

## Color Tokens

Neutral scale (surfaces, borders, text) plus one semantic accent token and status tokens (success/warning/danger/info), defined in `app/globals.css` under `@theme inline` alongside the existing `--color-background`/`--color-foreground` pattern already present in the scaffold. Both light and dark values defined; dark is the primary/default operational mode given the "calm, precise, dense" character goal, light remains supported via the existing `prefers-color-scheme` block pattern.

## Surface Hierarchy

Three levels: base (page background), raised (cards, panels), overlay (modals, drawers, dropdowns) — each one step lighter/darker than the last, distinguished by subtle background-shade and border differences rather than heavy shadow.

## Typography

Geist Sans (already configured) for UI text, Geist Mono (already configured) for data/numeric/code values (amounts, ids, timestamps) — reinforces the "precise, operational" character. No additional font families introduced without reason.

## Data Typography

Tabular/monospace figures for any column of numbers (financial values, counts) so digits align — a Phase 001-relevant rule even though Phase 001 has no numeric tables yet, since the company switcher and audit views will show timestamps/ids.

## Spacing Scale

Tailwind's default 4px-based scale, used consistently; dense layouts favor smaller gaps (`gap-2`/`gap-3`) over the large airy spacing typical of generic SaaS templates, per the "dense" principle.

## Radius Scale

Small, consistent radii (subtle rounding, not pill-shaped/over-rounded) — e.g. `rounded-md` as the default for cards/inputs/buttons, reserving fuller rounding only for true pill elements like status badges.

## Border System

Thin (1px), low-contrast borders to separate surfaces rather than heavy shadows or high-contrast dividers — keeps the dense, calm character.

## Elevation

Minimal shadow use; overlay surfaces (modals/dropdowns) get a small, restrained shadow plus a border, not a large soft glow.

## Icon System

One consistent icon set (recommend `lucide-react` when a package is approved for installation — not installed yet, flagged as a Phase 001 implementation decision, not assumed here) at a fixed stroke width, sized to match text (16/20px inline with UI text).

## Buttons

Primary (accent-filled, used sparingly — one primary action per view), secondary (bordered/neutral), ghost (text-only), destructive (danger-colored, used only for irreversible actions like removing a member). Consistent height across a given density context.

## Icon Buttons

Square, same height as text buttons at that density level, always with an accessible label (`aria-label`) since they carry no visible text.

## Inputs

Bordered, raised-surface background, clear focus ring using the accent token, inline validation error state (red border + message, not just a toast).

## Search

Not needed in Phase 001 (no searchable operational data yet). Reserved pattern: inline search input with icon-left, consistent with the Inputs spec above.

## Dropdowns

Used for the company switcher and role selectors — overlay surface, bordered, keyboard-navigable, closes on outside click/Escape.

## Checkboxes

Not needed for Phase 001's minimal UI. Reserved: standard bordered box, accent-filled check state.

## Switches

Not needed for Phase 001. Reserved for a future settings toggle pattern.

## Tabs

Not needed for Phase 001's minimal UI. **As implemented since Phase 004:** a plain text-link row (not underline-style, not pill tabs) — `app/(app)/[companySlug]/projects/[projectId]/layout.tsx`'s project detail sub-nav (Overview/Milestones/Tasks/Deliverables/Readiness/Scope/Activity/Team/Decisions). A scope simplification made during implementation, consistent with the "precise, not playful" character; the underline-indicator treatment described above remains the intended eventual pattern if this row grows a genuine "active tab" state worth highlighting.

## Segmented Controls

Not needed for Phase 001.

## Badges

Used for role labels (Founder/Director/Manager/etc.) and membership status (active/removed) — small, neutral-bordered by default, colored only for meaningful status.

## Status Pills

Used for invitation status (pending/accepted/revoked/expired) — pill-shaped is the one place fuller rounding is appropriate, colored per status (pending = neutral/info, accepted = success, revoked/expired = muted/danger).

## Risk Indicators

Not applicable in Phase 001 (no risk module). Reserved for future Risk Analysis module.

## Avatars

Simple circular avatar with initials fallback (no `avatar_url` set) for `user_profiles` display in the company member list and top bar.

## Metric Cards

Not needed for Phase 001 (no dashboard metrics yet — Today dashboard is a future module). Reserved pattern per AGENTS.md: dense, not oversized, data-forward.

## Project Cards

Not applicable in Phase 001.

## Finance Cards

Not applicable in Phase 001.

## AI Insight Cards

Not applicable in Phase 001 (no AI). Reserved pattern for future phases: every AI recommendation card must be able to show Recommendation, Evidence, Confidence, Freshness, Suggested Action (per AGENTS.md and this doc's AI Recommendation UI section).

## Evidence Chips

Not applicable in Phase 001.

## Data Tables

The primary pattern for the company member list and audit log view — dense rows, monospace for ids/timestamps, sortable headers where useful, row-level actions in a trailing icon-button column, explicit empty state.

## Timeline

Not applicable in Phase 001.

## Activity Log

The Phase 001 audit log view: a dense, timestamp-ordered list (or table) showing actor, action, resource, and result per row, filterable by company. This is one of the few real UI surfaces Phase 001 needs to build.

## Sidebar

Company-agnostic parent nav shell (per Parent Orex OS Visual Identity above); Phase 001 needs only a minimal version — enough to hold the company switcher and a link to the audit log, not the full module nav (Projects/Finance/etc. don't exist yet).

## Company Switcher

A required Phase 001 component: dropdown showing the companies (and, for founder/group-access users, the organisation-level "all companies" context) the current user has active membership in, with the company's accent-color badge, switching sets the active company context used by subsequent server actions/queries.

## Top Command Bar

Not required for Phase 001 beyond housing the company switcher and a user menu (sign out).

## Command Palette

Not applicable in Phase 001.

## Drawers

Not required for Phase 001's minimal UI. Reserved pattern: right-side overlay, used for invite-member and member-detail flows in a near-term follow-up if not in Phase 001 itself.

## Modals

Used for confirm-style actions in Phase 001 (e.g., confirming member removal) — centered overlay, small, single clear action pair (confirm/cancel). **As implemented:** member removal actually uses a native browser `window.confirm()` dialog (`components/team/MemberTable.tsx`), not a custom modal component — a scope simplification made during implementation. A real modal component is still the intended pattern for future confirm-style actions; the native dialog should be replaced once a general-purpose Modal component exists and is worth building for its own sake.

## Notifications

Not implemented in Phase 001 beyond inline form/action feedback (success/error states on the invite and member-management actions). No toast/notification-center system built yet.

## Permission UI

A minimal read-only permission-matrix view (per role) may be shown to founder/director users for transparency; full permission-editing UI is not required for Phase 001 (the matrix is seeded, not user-edited, in this phase).

## AI Recommendation UI

Not applicable in Phase 001. Reserved principle carried from AGENTS.md: every serious AI recommendation must visually support Recommendation, Evidence, Confidence, Freshness, Suggested Action.

## Empty States

Every list view (company list, member list, invitation list, audit log) defines an explicit, on-brand empty state message — never a blank panel.

## Loading States

Skeleton or minimal spinner states for the company switcher and any data-fetching list, consistent with the dense/calm character (no large centered spinners).

## Error States

Inline, specific error messaging tied to the failing action (e.g., "This invitation has expired" rather than a generic failure toast), never leaking raw server/database error text (see `docs/security.md` Output Validation).

## Responsive Rules

Sidebar collapses to an icon rail or overlay below a defined breakpoint; data tables scroll horizontally rather than reflowing into unreadable stacked cards at narrow widths, consistent with the "dense, operational" character rather than a mobile-first consumer layout.

## Accessibility

Keyboard-navigable dropdowns/modals, visible focus rings using the accent token, sufficient contrast in both light and dark modes, `aria-label`s on icon-only controls.

## Component Naming Rules

PascalCase component files under `components/`, grouped by domain where it helps (`components/company/CompanySwitcher.tsx`, `components/audit/AuditLogTable.tsx`) rather than one flat directory — mirrors the module architecture in `docs/architecture.md` without prematurely creating module directories that don't have code yet.

## Design Tokens

Defined in `app/globals.css` under the existing `@theme inline` block: extend with neutral surface levels, the `--accent` company token, and status colors, following the same CSS-variable + Tailwind-v4-theme pattern already present rather than introducing a separate token system (e.g., a JS theme object) that would fight the existing setup.

## Phase 001 Components Needed

Only the company/auth/permissions-foundation components:

1. Sign-in form
2. Minimal authenticated shell (sidebar + top bar placeholder)
3. Company switcher
4. Company member list (data table) + invite form + remove-member confirmation
5. Invitation acceptance flow (accept-invite page)
6. Audit log view (data table)
7. Minimal read-only permission matrix view (optional but recommended for founder transparency)

None of these are implemented by this document — it identifies what's needed; implementation happens only under an approved `prompts/001-foundation.md`.

**Status: Phase 001 CLOSED.** Items 1–6 are implemented. Item 7 (permission matrix view) was not built — deferred, not required for Phase 001 acceptance criteria. Item 4's "remove-member confirmation" is a native `window.confirm()` dialog, not a custom modal component — see Modals above.

**Since Phase 001:** Phase 003 (Company Brain) and Phase 004 (Projects and Delivery) both shipped real UI reusing this system's existing dense-table, badge, and form conventions without introducing a new visual language — `components/knowledge/*`, `components/decisions/*`, and `components/projects/*`. No new design tokens were added by either phase; the token set defined above (surface/border/muted/accent/status colors) has proven sufficient for a knowledge browser, a decision/scope-change/readiness-checklist set of tables, and a 9-tab project command view.

## UI System Pass (2026-09-05) — approved premium dark shell

The founder approved a specific dark, graphite/ivory operating-system visual direction (reference: Founder Dashboard mock) and this pass applied it to the real application. This section is the authoritative record; it supersedes the *look* described above where they conflict, not the underlying principles (dense, calm, precise, no per-company reskin, honest data only).

### Color tokens (`app/globals.css`)

Committed **dark-only** (`color-scheme: dark` painted unconditionally — this is a fixed product identity, not a user-toggled theme). Legacy variable names (`--background`, `--foreground`, `--surface`, `--muted`, `--accent`, `--success`/`--warning`/`--danger`) are kept as aliases onto the new tokens so every pre-existing component upgraded automatically with zero per-file edits.

- Surfaces: `--background` `#08090a`, `--background-secondary` `#0b0c0c`, `--surface-1/2/3` (`#0e1010` → `#151717`), `--surface-raised` `#181a19`, `--surface-sunken` `#0d0f0e`.
- Borders: `--border-subtle` `rgba(255,255,255,.07)`, `--border-medium` `.11`, `--border-strong` `.16`.
- Text: `--text-primary` `#f1f0ea` (warm ivory), `--text-secondary` `#a5a59f`, `--text-muted` `#70726f`.
- Accent: `--accent` `#d8d6c8` (restrained silver, app-wide default — never saturated).
- Company accents (narrow use only — switcher badge dot, active nav, header underline; never a full-page reskin): `--company-group` (neutral silver), `--company-orextic` `#c8703b` (muted coral), `--company-orex-studios` `#8ea0ac` (cool silver-blue).
- Semantic: `--success`/`--warning`/`--danger`/`--info`, each paired with a `-dim` background tint for pill fills. No neon/saturated variants.

### Typography

Geist Sans (UI, unchanged) + Geist Mono (`.num`/`.font-data`, tabular figures — unchanged) + **Fraunces** (new, `--font-fraunces` / `.font-display`), added via `next/font/google` in `app/layout.tsx`. Fraunces is used **only** for founder-emotional moments: the Today greeting, the focus statement, and the quote — never tables, forms, nav, or any operational data, per this document's original Typography principle.

### Spacing / radius / surfaces

8px-grid spacing throughout the new shell and pages (`px-8`/`py-6` page padding, `gap-3.5` card grids). Radius scale: `--radius-s` 6px (buttons/inputs/pills-as-rect), `--radius-m` 10px (dropdowns, small cards), `--radius-l` 14px (page-level cards, modal, hero). Cards are distinguished by surface + 1px `--border-subtle` + spacing, never color or heavy shadow.

### Centralized primitives (`components/ui/`)

`Button` (primary/secondary/ghost/danger via `buttonClass()`), `Surface.tsx` (`Card`, `CardHeader`, `PageHeader`), `EmptyState`, `Avatar` (initials fallback), `Modal` (centered dialog — used for Invite Member / New Project so forms no longer permanently occupy the page header), `icons.tsx` (one hand-authored outline SVG set, 1.6 stroke, sized to text — **no icon package is installed**; this is a deliberate scope-discipline call, not an oversight, since Phase 001's design doc only "recommended" one "when approved," and a whole-app icon-package swap is a bigger decision than this pass's brief). Shared utility classes in `globals.css` (`.ox-btn*`, `.ox-input`/`.ox-select`/`.ox-textarea`, `.ox-card`, `.ox-table`, `.ox-pill*`, `.ox-empty*`, `.ox-focus-ring`) centralize the visual language so most page/table files need only class-name changes, not structural rewrites.

### App shell

Replaced the top-nav layout with a permanent left sidebar (`components/shell/Sidebar.tsx`, ~236px, sticky/full-height) + independently-scrolling main content, built in `app/(app)/[companySlug]/layout.tsx` (moved down from `app/(app)/layout.tsx`, which is now a pure auth gate — the shell needs the company slug to build company-scoped nav links). Sidebar renders: brand mark, `CompanySwitcher` (rewritten — closes on outside-click/Escape, shows the other companies the user belongs to beneath the active one), a static (non-functional) search affordance, six grouped nav sections (Essentials/Operations/Intelligence/Finance/Team/Admin), and a footer with the real authenticated user's avatar/name/role label (`lib/database/profile.ts` `getSidebarIdentity` — **read-only presentation, not an authorization check**; every page still enforces its own `hasPermission`/RLS independently) plus sign-out.

Only routes that actually exist are real links: Today, Projects, Delivery, Company Brain, Decisions, Team. Everything else the reference mock implied (Inbox, Calendar, Advisor, Clients, Meetings, Opportunities, Reports, Finance, Transactions, Settings) renders disabled with a "Soon" marker rather than a dead or fake link — no placeholder functionality that appears to work.

### Today dashboard (`app/(app)/[companySlug]/page.tsx`)

Company-scoped (there is no cross-company aggregate query path in the current data model, so "Today" shows the active company's real data, not a fabricated org-wide rollup). Every section is wired to a real table or explicitly marked unavailable — no sample values from the reference mock (Rs 1.25M, 78/100, etc.) were hard-coded:

- **Hero**: real date + a client-ticking local-time clock (`components/shell/LiveClock.tsx`, `useSyncExternalStore`, no setState-in-effect). No weather/location — that infrastructure doesn't exist, so it's omitted rather than faked.
- **Today focus panel**: static restrained motivational copy (explicitly allowed as fallback per AGENTS.md — makes no claim about actual business conditions).
- **Top Priorities**: real `project_tasks` (assigned-to-me or due-today-or-earlier, open, max 5).
- **Needs Your Decision**: real `decisions` where `status in (proposed, in_review)`, max 3; empty state, never sample decisions.
- **Today Status** (replaces the mock's invented "Day Score /100"): real counts — Overdue / Due today / Blocked tasks, Waiting-approval deliverables. No fabricated scoring.
- **KPI strip**: Active Projects is real (`projects.status = 'active'` count); Meetings/Income/Risks/Opportunities render "Not connected yet" — those modules don't exist.
- **Today's Timeline**: empty/future state — no Calendar module yet.
- **Recent Project Updates**: real `project_activity` rows (not `audit_logs`), tone-mapped by real `event_type` values already written by Phase 004 actions.
- **AI Suggestions**: inactive state — OpenRouter is never called to fill visual space.
- **Finance Pulse**: inactive state — Finance module doesn't exist.
- **Delivery Ready**: real `projects` nearest delivery (active/review/delivery_ready, sorted by target date, max 5).

### Existing modules

Team, Projects (list + detail tab shell), Delivery Ready, Company Brain (overview + Ask box), and Audit were restyled onto the new tokens/primitives (`PageHeader`, `Card`, `EmptyState`, `.ox-table`, pills). Invite Member and New Project moved into a `Modal` instead of a permanent header form. Deep project sub-pages (Milestones/Tasks/Deliverables/Readiness/Scope/Team/Decisions tables and forms) were **not** individually rebuilt this pass — they inherit the new palette for free through the shared CSS-variable aliases but still use their original markup; this was a deliberate sequencing choice ("don't redesign every deep sub-page before the shell works"), not an oversight, and is the next natural slice of this work.

### Known follow-up (not fixed in this pass, flagged for the founder)

Independent of this UI pass: a security-advisor scan surfaced during earlier phases found that Phase 001's `0009_harden_function_grants.sql` revokes `EXECUTE` from `anon`/`authenticated` directly on `handle_new_user`/`has_company_permission`/`has_org_permission`/`is_company_member`, which does not remove the implicit grant those roles inherit through `PUBLIC` — the same class of bug fixed correctly for two Phase 004.5 trigger functions via a `revoke ... from public` migration. Still open; out of scope for this UI-only pass.
