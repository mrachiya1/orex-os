# 011 — Project Export / Import

## Files inspected

- `app/actions/projects.ts` (createProject — canonical "create + seed children" template)
- `app/actions/project-milestones.ts`, `project-tasks.ts`, `project-deliverables.ts`, `project-deliveries.ts`,
  `project-scope-changes.ts`, `project-readiness-checks.ts`, `project-properties.ts`, `project-sections.ts`,
  `project-blocks.ts`
- `lib/projects/workspace.ts` (`ensureDefaultWorkspaceSections`), `lib/projects/milestone-tree.ts`, `lib/projects/types.ts`
- `supabase/migrations/0019_projects_and_delivery.sql` (`has_project_access`, table shapes, RLS)
- `supabase/migrations/0023_project_workspace.sql` (sections/blocks)
- `supabase/migrations/0027_project_properties_and_milestone_tree.sql`
- `lib/permissions/catalog.ts`, `lib/permissions/index.ts` (`requireProjectAccess`, `requirePermission`, `requireScopedPermission`)
- `components/projects/*Table.tsx`, `components/ui/Surface.tsx`, `components/ui/Modal.tsx`, `components/ui/Button.tsx`
- Confirmed via repo-wide grep: **no export/import/download/file-upload pattern exists anywhere today.** This is a
  greenfield vertical slice, not an extension of partial work.

## What exists that must be preserved

Nothing changes in the existing create/read/update paths for projects — this is purely additive (one export
route, one import action, two small UI controls on the Projects page). No existing schema, RLS policy, or
server action is modified.

## Decisions

1. **Scope: one project at a time**, matching the founder's wording ("export project" / "import project"), not a
   bulk multi-project export. Triggered from the project detail page (an action next to the existing
   status/health controls), not the company-wide Projects table.
2. **Export format: a single JSON file**, downloaded via a `GET` Route Handler
   (`app/api/projects/[projectId]/export/route.ts`) so the browser gets a real `Content-Disposition: attachment`
   download — there is no existing download pattern to reuse, and a Server Action cannot stream a file download.
3. **What's included in the export** (the project's own authored content):
   `projects` core fields, `project_members` (role + status only, not full profiles), `project_milestones`
   (full tree via `parent_milestone_id`), `project_tasks`, `project_deliverables`, `project_scope_changes`,
   `project_readiness_checks`, `project_sections` + `project_blocks`, `project_property_values` (joined against
   `project_property_definitions` to export the property **name + type**, not just an opaque definition id, so
   the value is meaningful outside the source company).
4. **What's excluded** (deliberately, to avoid overbuilding and avoid misrepresenting history):
   - `project_deliveries` (append-only delivery history) and `project_activity` (audit-style timeline) —
     historical records of what actually happened in the source company; re-importing them as a "new" project's
     history would be fabricated data (AGENTS.md rule 14).
   - `decisions` — these are a separate top-level Company Brain entity, not owned by the project; only exported
     by reference (id + title, not full content) as a manifest note, never re-created on import.
   - Any user PII beyond an email address used for optional matching (see #5) — no names, no avatars, no
     private-profile data.
5. **User references (owner/lead/assignee/completed_by/etc.) are exported as an email string, not a UUID.**
   On import, if a `company_members` row for that email already exists in the **target** company, it's remapped
   to that user's id; otherwise the field is imported as `null` (unassigned) — never silently assigned to the
   importing user, never left as a dangling foreign id from another company.
6. **Import always creates a brand-new project** in the importing user's current company — never upserts over an
   existing project, never trusts any id in the file. `project_code` (if present) is regenerated if it would
   collide in the target company; milestone `parent_milestone_id` chains are remapped to newly-generated ids
   preserving tree structure and depth ordering (reuses the existing depth/cycle guard in the DB trigger — no
   new trigger needed since inserts happen in tree order, parents before children).
7. **Permissions**: reuse `PERMISSIONS.PROJECTS_READ` (via `requireProjectAccess`) to gate export, and
   `PERMISSIONS.PROJECTS_CREATE` (via `requireScopedPermission`, same check `createProject` already uses) to
   gate import — no new permission catalog entries, no new migration needed.
8. **Validation**: the import payload is parsed with a new Zod schema (`lib/validation/project-export.ts`)
   before anything touches the database — rejects unknown top-level shape, enforces a max array length on every
   child collection (milestones/tasks/deliverables/etc., e.g. 500 each) to prevent a malicious oversized file
   from causing a runaway insert, and checks a `schemaVersion: 1` field so a future format change fails loudly
   instead of silently importing garbage.

## Architecture

- `app/api/projects/[projectId]/export/route.ts` — `GET`, auth + `requireProjectAccess(projectId, PROJECTS_READ)`,
  queries all included tables scoped to `projectId`, shapes the JSON (`{ schemaVersion: 1, exportedAt, project: {...} }`),
  returns with `Content-Disposition: attachment; filename="<project-code>.orexos-project.json"`.
- `lib/validation/project-export.ts` — Zod schema for the export/import JSON shape (shared by both sides so the
  writer and reader can never drift).
- `app/actions/project-import.ts` — new file, `importProject(companyId, input: unknown): Promise<ActionResult<{projectId}>>`
  following the existing `ActionResult` pattern (`lib/actions/result.ts`) so no error is ever thrown across the
  action boundary. Internally: parse → `requireScopedPermission` → look up target-company members by email for
  remapping → insert `projects` row → insert children in dependency order (milestones parents-first, then
  tasks/deliverables/scope changes/readiness checks/sections/blocks/property values) → `writeAuditLog` (single
  entry: `project.imported`, metadata = source project name + counts, not the whole payload) → `writeProjectActivity`
  on the new project (`project.imported`).
- `components/projects/ExportProjectButton.tsx` — plain `<a href="/api/projects/[id]/export">` styled as a button
  (no JS needed for a same-origin authenticated GET).
- `components/projects/ImportProjectDialog.tsx` — `Modal` + file `<input type="file" accept="application/json">`,
  reads the file client-side with `FileReader`, `JSON.parse`s it, calls `importProject` as a Server Action, shows
  `ActionResult` errors inline (bad JSON, schema version mismatch, permission denied), redirects to the new
  project on success.

## Security implications

- Export requires the same `PROJECTS_READ` check as viewing the project — no new data becomes readable.
- Import requires `PROJECTS_CREATE` **in the target company**, scoped exactly like `createProject` — a
  contractor with access to one project in Orextic still cannot import into Orex Studios.
- The import payload is untrusted input from a file the user chose (possibly edited by hand, or exported from a
  different company they also belong to) — validated strictly with Zod before any DB write; array-length caps
  prevent a resource-exhaustion attempt; no field is ever interpreted as SQL or used to bypass RLS (all inserts
  go through the normal Supabase client, subject to RLS, exactly like `createProject`).
- No secrets, finance data, or client vault data are part of a project's export shape — none of that lives on
  these tables.
- The exported file itself is not treated as a secret (it's the same data the exporting user could already see
  in the app) but the Route Handler still requires an authenticated session — no unauthenticated export URL.

## Acceptance criteria

1. A user with `projects.read` on a project sees an "Export" control on that project's detail page; clicking it
   downloads a `.json` file containing the shape above.
2. A user with `projects.create` in a company sees an "Import project" control on the company's Projects page;
   selecting a valid exported file creates a new project with its full milestone tree, tasks, deliverables,
   scope changes, readiness checks, sections/blocks, and property values intact, and redirects to it.
3. Importing into a *different* company than the file was exported from succeeds, with every user reference
   that doesn't match an email in the target company's membership left unassigned (never cross-assigned to the
   wrong person).
4. Importing a malformed file (wrong shape, wrong `schemaVersion`, oversized arrays) fails with a clear
   `ActionResult` error and creates nothing (no partial project).
5. A user without `projects.create` in the target company cannot import, even with a valid file (server-enforced,
   not just hidden in the UI).
6. No existing project page, action, or table is modified in a way that changes current behavior.

## Tests

- `lib/validation/project-export.test.ts` — schema accepts a well-formed payload; rejects wrong `schemaVersion`,
  missing required fields, and oversized arrays.
- `app/actions/project-import.test.ts` — permission denial path; email-remap-hit path; email-remap-miss (null)
  path; milestone-tree parent remapping preserves structure; rejects malformed input without partial writes.
- Manual test steps (post-implementation):
  1. Export an existing project with at least one nested milestone, one task, one deliverable, and one custom
     property value. Confirm the downloaded JSON contains all of it.
  2. Import that file into the **same** company as a different project — confirm user references remap
     correctly (they're all real members here).
  3. Import the same file into the **other** company (Orextic vs Orex Studios) as a user with `projects.create`
     there — confirm it succeeds and every user reference is `null` (no matching members).
  4. As a contractor/viewer without `projects.create`, attempt import — confirm server-side rejection.
  5. Hand-edit the JSON to remove `schemaVersion` — confirm import fails cleanly with no project created.

## Open question before implementation

None blocking — the email-based remap strategy (#5 above) is my recommendation for the ambiguous "what happens
to user references on import" question; flagging it explicitly in case you'd prefer a different default (e.g.
always assign to the importing user instead of leaving null).
