# Project Folders + Hero/Overview Redesign

## Status

IMPLEMENTED, PARTIAL (2026-09-05). Another 46-section request; per AGENTS.md and the founder's own "REMAINING GAPS" report heading, this pass implements Project Folders (the headline new UX change) and a full Project Hero/Overview redesign matching the reference screenshot closely, reusing the inline-edit cells from `prompts/007`. Tasks/Deliverables/Readiness/Scope/Activity/Team/Decisions tab redesigns, drag-and-drop, and thumbnails remain deferred — see Remaining Gaps.

## Folders

`project_folders` (self-referencing `parent_folder_id`, same integrity-trigger pattern as nested milestones) + `projects.folder_id`. Explicitly **not** an authorization boundary — no RLS policy on `projects` reads `folder_id`; moving a project between folders only changes `projects.updated_at` and `folder_id`, nothing permission-related. Verified live: cross-company folder parent rejected, a project's `folder_id` from a different company than the project itself rejected (`enforce_project_folder_scope`), the legitimate same-company path works end-to-end, and a user with zero company access is denied folder creation.

UI: `FolderTree` renders as a left rail inside the Projects card — "All Projects" / folder tree (expand-collapse, contextual `+` per folder for a subfolder) / "Unfiled Projects", each with a live project count. Selecting a folder filters the table client-side (no new query — folders are cheap, already-fetched metadata). A `FolderCell` (reusing the `Popover` primitive from `prompts/007`) lets any row move to a different folder inline; it's an optional column via Properties, not shown by default. Creating a project while a folder is selected pre-fills that project's `folder_id`.

**Reduced from the full spec:** folder reorder/rename/drag-and-drop, and a folder's own three-dot menu (archive/duplicate-structure) aren't built — `archiveFolder`/`renameFolder`/`moveFolder` actions exist server-side (tested via typecheck/build, not yet wired to UI controls beyond create). Nesting is architecturally unlimited (same 10-level cap as milestones) but the UI only exercises folder → subfolder → project in practice.

## Project Hero / Overview redesign

`[projectId]/layout.tsx` now renders a breadcrumb (`Projects / {name}`), a real hero (icon placeholder, name, Status/Health pills — both inline-editable via the same `StatusCell`/`HealthCell` from the Projects table, not read-only badges), and a primary-properties row (Client, Assigned, Start, Deadline, Priority, Category, Code) using the identical inline-edit cells — one editing system, no duplicated logic between the table and the project page.

The Overview page is restructured into the requested three rows: **Row 1** — Overall Progress (a real SVG ring from actual task counts, not decorative), Timeline, Status & Health, Quick Actions (links into each tab, plus the readiness-gated "Mark delivery ready" action, preserved from the old `StatusActions` component which is now deleted as dead code). **Row 2** — What's Next (blocked/overdue/next-milestone/next-tasks, real data, max 5), Recent Activity (unchanged `ProjectActivityFeed`), Project Details (Client/Value/Start/Deadline/Created/Updated/Last Review/Reviewed By — the last three honestly show "—", not fabricated). **Row 3** — the existing Phase 004.5 Operational Workspace (custom sections/blocks), unchanged, just re-labeled and re-homed under the new grid.

## Files created

Migration `0029`. `lib/validation/project-folders.ts`. `app/actions/project-folders.ts`. `components/projects/database/FolderTree.tsx`. `components/projects/MarkDeliveryReadyAction.tsx`.

## Files modified

`lib/validation/projects.ts` + `app/actions/projects.ts` (+`folderId` on project creation), `components/projects/{ProjectForm,NewProjectButton}.tsx` (folder-aware creation), `lib/projects/system-properties.ts` (+`folder` column), `components/projects/database/{Cells,ProjectDatabase}.tsx` (folder filtering + `FolderCell`), `app/(app)/[companySlug]/projects/page.tsx` (fetches folders), `app/(app)/[companySlug]/projects/[projectId]/layout.tsx` (hero rebuild), `app/(app)/[companySlug]/projects/[projectId]/page.tsx` (overview grid rebuild). Deleted: `components/projects/StatusActions.tsx` (fully superseded, no remaining imports).

## Remaining Gaps

- **Folder rename/reorder/archive UI, drag-and-drop** (folders, projects, milestones) — server actions exist, no UI controls yet beyond create.
- **Project thumbnails / Storage** — still not started; needs a real bucket/access-policy decision.
- **Tasks/Deliverables/Readiness/Scope/Activity/Team/Decisions tab redesigns** — untouched, still their original Phase 004 markup (inherits the dark token palette for free, not restructured onto the new primitives).
- **Client Extra Requests card** (the `project_scope_changes`-backed table shown in the spec) — not built; Quick Actions links to the existing Scope tab instead.
- **Project Value / Last Review / Reviewed By** — still shown as "—"; needs the schema decision flagged in `prompts/007`.
- **Files tab** — not added; no file storage exists to back it.
