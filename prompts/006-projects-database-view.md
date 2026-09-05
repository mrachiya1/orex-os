# Projects Database View — Notion-like flexibility on structured data

## Status

DRAFT — awaiting approval. Unlike the shell/Today UI pass, this introduces real schema (two new tables + a handful of additive columns), which AGENTS.md requires stopping and reporting before implementation.

## Objective

Turn `/[companySlug]/projects` into a customizable database-style table (Notion's interaction model: add/hide/reorder columns, per-view filter/sort) while keeping every structured Phase 004 table (`projects`, `project_tasks`, `project_milestones`, `project_deliverables`, `project_members`, `decisions`, etc.) as the sole source of truth for operational data. Custom properties are a thin, validated extension layer next to that data — never a replacement for it.

## Schema

### Additive columns on `projects` (nullable, no backfill needed, no existing query breaks)

- `value_amount numeric`, `value_currency text default 'LKR'` — real project value; null until a user sets it, never a placeholder number.
- `last_reviewed_at timestamptz`, `last_reviewed_by uuid references user_profiles(id)` — "Last Review Date"/"Reviewed By".

### New table: `project_property_definitions`

```
id uuid pk
organisation_id uuid not null references organisations(id)
company_id uuid references companies(id)          -- null = org-wide definition
name text not null
property_type text not null check (property_type in
  ('text','number','select','multi_select','status','date','person','files','checkbox','url','email','phone'))
configuration jsonb not null default '{}'          -- e.g. { options: [...] } for select/multi_select/status
position integer not null default 0
created_by uuid references user_profiles(id)
created_at, updated_at timestamptz
```

`configuration` is Zod-validated per `property_type` server-side before insert/update — never trusted as opaque JSON (same pattern as Phase 004.5's `project_blocks.content`).

### New table: `project_property_values`

```
id uuid pk
organisation_id uuid not null references organisations(id)
company_id uuid references companies(id)
project_id uuid not null references projects(id) on delete cascade
property_definition_id uuid not null references project_property_definitions(id) on delete cascade
value jsonb not null default 'null'
created_by, updated_by uuid references user_profiles(id)
created_at, updated_at timestamptz
unique (project_id, property_definition_id)
```

`value`'s shape is validated against the *definition's* `property_type` at write time (a `select` value must be one of that definition's configured options, a `checkbox` value must be boolean, etc.) — mirrors `validateBlockContent` from Phase 004.5. A trigger (mirroring `enforce_block_section_project_match`) enforces `project_property_values.company_id` matches `projects.company_id` for the referenced project — same cross-parent-integrity pattern as Phase 004/004.5.

### New table: `project_views`

```
id uuid pk
organisation_id uuid not null references organisations(id)
company_id uuid references companies(id)
name text not null
view_type text not null default 'table' check (view_type in ('table'))   -- board/timeline deferred
configuration jsonb not null default '{}'   -- { visibleColumns: [...], order: [...], sort, filters }
created_by uuid references user_profiles(id)
is_shared boolean not null default false
created_at, updated_at timestamptz
```

A non-shared view is only visible to its creator; a shared view is visible to everyone with `projects.read` on the company. No per-view permission overrides — visibility of the *data* a view renders is still governed entirely by RLS on the underlying tables, a view can only narrow which real columns are shown, never grant access to a row the viewer couldn't already see.

## Permissions

Reuses existing keys, no new permission family:
- Reading properties/values/views → `PROJECTS_READ`
- Creating/editing property *definitions* (schema-level, company-wide impact) → `PROJECTS_UPDATE` (director+, matching who can already edit project structure)
- Setting a property *value* on one project → same check as any other project field edit: `hasProjectAccess(projectId, PROJECTS_UPDATE)`
- Creating a personal view → `PROJECTS_READ` (anyone who can see the list can save their own view); creating a *shared* view → `PROJECTS_UPDATE`

## RLS (mandatory tests before this closes)

- A user without `projects.read` on a company sees zero property definitions/views for it.
- A Contractor scoped to Project A cannot see or set property values on Project B (same `has_project_access` narrowing as tasks/deliverables).
- A forged `company_id` on a property definition or view insert is rejected (RLS + a scope trigger, not just the app-layer check).
- Deleting a property definition cascades its values (tested), never silently orphans rows.

## What's computed, not stored

"Next Task" (earliest incomplete `project_tasks` row), "Progress" (`done` / total task count), "Delivery Status" (derived from `project_readiness_checks` + `status`), "Client Project Count" (count of `projects` sharing the same `client_display_name` within the company) — all resolved at query time in the page/server action, exactly like Phase 004.5's `project_view` blocks. None of these get a stored column, so there's nothing to drift out of sync.

## UI scope for V1

- Table view only. Row height ~44px, inline edit for safe types (text/number/select/checkbox/date), status pills reusing `ProjectStatusBadge`, person field showing `Avatar`.
- Toolbar: Search (client-side filter on loaded rows — no new search infra), Sort, Properties (popover: toggle system + custom columns, "+ New property"), New Project (existing modal).
- "+ New property" flow exactly as specified: name, type, type-specific config (options for select/multi-select/status), Save → column appears immediately.
- Compact stats strip (Active / At Risk / Due Soon / Delivery Ready) computed from real `projects.status`/`health_state`/`target_date` — omitted entirely if a company has zero projects, never shown as fake zeros dressed up as real metrics... actually zero is real and fine; just never a non-zero placeholder.
- Filter and Board view: **not** in this slice — you marked Board "if it fits cleanly" and Timeline as future; I'd rather ship Table well than half-ship three view types. Can follow immediately after if you want Board next.

## Open call I made without asking

"Assigned" maps to `lead_id` (single project lead), not `project_members` (which can hold several people with different roles). Multi-person "Assigned" as an avatar stack is a reasonable V2 if you want it — flagging rather than silently picking the bigger scope.

## Testing

Same bar as Phase 004.5: typecheck/lint/test/build, live RLS impersonation (forged company_id, cross-project value writes, Contractor narrowing), zero-leftover-rows cleanup, browser bundle secret scan.

---

Say go and I'll implement this slice (migrations → validation schemas → server actions → table UI). If any of the schema/mapping calls above should go differently, tell me which and I'll adjust before writing code.
