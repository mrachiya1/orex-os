# Projects Database — Notion-like flexibility on structured data

## Status

IMPLEMENTED, PARTIAL (2026-09-05). The founder's request (44 sections) is genuinely a multi-week scope. Per AGENTS.md ("smallest complete vertical slice", "do not overbuild") and the founder's own final-report template (which includes "REMAINING GAPS"), this pass implements the highest-leverage slice — nested milestones with real tree integrity, a validated custom-property engine, and a genuinely inline-editable Projects table with default urgent sorting — and defers the rest explicitly rather than half-building everything. See "Remaining Gaps" below for exactly what's not done.

## Why the previous Projects page couldn't be Notion-like

Inspected before writing any code: `ProjectTable` rendered plain `<td>` text with zero interactivity; every property lived on one fixed `projects` row with no extension point for user-defined metadata; there was no per-viewer column/order preference (one hard-coded column set for everyone); milestones were a flat list (`project_milestones` had no self-reference) so there was no way to represent "Pre Production → Concept → Client Approval"; and the default project list was sorted by `created_at`, which tells you nothing about what's urgent today.

## What's real vs. computed

System properties (Project, Category, Status, Health, Priority, Deadline, Start Date, Client, Assigned) are the actual `projects` columns — never duplicated into the new property tables. Next Task and the row-expansion milestone summary are computed at render time from `project_tasks`/`project_milestones`, exactly like a Phase 004.5 `project_view` block — never stored, never able to drift out of sync. Custom properties (Renderer, Platform, etc.) are the only things that live in the new `project_property_definitions`/`project_property_values` tables.

## Schema (migrations 0027–0028)

- `project_milestones.parent_milestone_id` (nullable self-FK) + `enforce_milestone_parent_integrity()` trigger: rejects self-parenting, cross-project parenting, cycles, and chains beyond 10 levels. Verified live (impersonated as the real founder account, in rolled-back transactions, zero leftover rows): self-parent rejected, cross-project parent rejected, a legitimate 2-level chain accepted.
- `project_property_definitions` / `project_property_values` — company-scoped custom metadata, Zod-validated per type both for `configuration` (e.g. a `select`'s option list) and for `value` (e.g. a `person` value must resolve to a real active company member). A trigger (`enforce_property_value_scope`) rejects a value whose project belongs to a different company than its definition — verified live.
- `project_views` — one row per (company, user); stores `visibleColumns`/`order`. Deliberately narrower than the founder's "named, shareable saved views" ask — see Remaining Gaps.
- **Grant-hardening repeat finding:** the advisor scan flagged the two new trigger functions as directly `EXECUTE`-granted to `anon`/`authenticated` — a *different* mechanism than the PUBLIC-inherited grant fixed in migration `0025` (that fix, revoking from PUBLIC, did not touch this case; these were direct per-role grants applied automatically by Supabase's default privileges at `CREATE FUNCTION` time). Fixed in migration `0028` by revoking from `public, anon, authenticated` together. Recommend a full audit of every `SECURITY DEFINER` function's grants in one pass at some point, rather than finding each one reactively — flagged, not done here (scope).

## Inline editing

Status (popover, options limited to the real lifecycle graph in `lib/projects/lifecycle-graph.ts` — the same graph the server enforces, so the UI never offers an impossible transition, and `changeProjectStatus()` re-validates independently regardless), Priority, Health (popover), Assigned (popover of real company members), Category/Client (inline text, on-blur commit), Deadline/Start Date (inline date), and every custom property type (checkbox toggle, select/multi-select/person popovers, text/number/date/url/email/phone inline) — all through the existing server actions (`updateProject`, `updateProjectHealth`, `changeProjectStatus`, `setPropertyValue`), never a direct client write. `delivery_ready` is excluded from the inline status popover (matches `StatusActions`' existing behavior) since it requires the atomic readiness gate in `markDeliveryReady()`, not a bare status flip.

## Properties panel / Add Property

`+` opens a popover (name, type, options-if-applicable) → `createPropertyDefinition` → the column appears after a refresh. The Properties popover lists system + custom columns with a checkbox (show/hide) and ↑/↓ reorder (no drag-and-drop, consistent with the earlier shell-pass decision not to add a dnd dependency); a custom property can also be deleted from here. Every change persists via `setMyProjectView`.

## Default urgent sort

`lib/projects/urgency.ts` — a deterministic bucket function (overdue → blocked → due today → due tomorrow → within 3 days → high/urgent priority → this week → everything else → completed/archived last), unit-tested. Always applied; there is no manual sort control yet (see Remaining Gaps).

## Row expansion / milestone tree

Clicking a row's chevron lazily fetches that project's milestones+tasks (`getProjectMilestoneSummary`) and renders the same `MilestoneTree` component used on the dedicated Milestones tab — top-level expanded by default, deeper levels collapsed, exactly matching the founder's worked example. Inline "+ Sub-milestone" / "+ Task" at every node, progress counts computed recursively (a parent's x/y includes its descendants' tasks). A project's milestones/tasks are fetched once as a flat list (typically dozens of rows, not thousands) and the tree is built client-side — deliberately not lazy-per-node, to avoid N+1 round trips at this scale.

## Files created

Migrations `0027`, `0028`. `lib/projects/{lifecycle-graph,property-types,system-properties,urgency,milestone-tree}.ts` (+3 test files). `lib/validation/project-properties.ts` (+test file). `app/actions/{project-properties,project-views}.ts`. `components/projects/MilestoneTree.tsx`. `components/projects/database/{Cells,AddPropertyMenu,PropertiesPanel,ProjectDatabase}.tsx`. `components/ui/Popover.tsx`.

## Files modified

`lib/projects/lifecycle.ts` (re-exports the shared graph instead of duplicating it), `components/projects/StatusActions.tsx` (uses the shared graph), `lib/validation/projects.ts` + `app/actions/project-milestones.ts` (parent_milestone_id support), `lib/validation/projects.ts` (`leadId` now nullable so "Unassigned" actually clears it), `app/actions/projects.ts` (+`getProjectMilestoneSummary`), `app/(app)/[companySlug]/projects/page.tsx` (rebuilt around `ProjectDatabase`), `app/(app)/[companySlug]/projects/[projectId]/milestones/page.tsx` (rebuilt around `MilestoneTree`).

## Remaining Gaps (explicit, not silently dropped)

- **Thumbnails / Storage** — not started. Needs a real Supabase Storage decision (bucket, access policy, upload path); flagged rather than rushed.
- **Project page redesign** (heading with pinned properties, collapsible details panel grouped by Project Info/Client/Team/Review/System, Client Requests wired to `project_scope_changes` with the exact table shown in the spec, `project.reviewed` activity event + Last Review/Reviewed By display) — not started; the existing Overview page (Phase 004.5's workspace) is unchanged.
- **Project Value / Last Review** system properties — need new `projects` columns not part of this migration; the property registry has a comment marking exactly where they'd slot in.
- **Filter UI, manual Sort control, Board/Gallery views** — not built; urgent sort is the only sort in V1.
- **Multi, named, shareable saved views** — reduced to one view per (user, company); no "All Projects / Urgent / My Projects" picker.
- **Column resize, drag-to-reorder** — reorder is ↑/↓ buttons only.
- **Client Project Count** — not computed (needs a decision on what "same client" means without a real Clients table beyond string-matching `client_display_name`, which felt too fragile to ship silently).
- **Virtualization/pagination** — not needed yet at current data volumes; flagged for whenever a company's project count grows large.
