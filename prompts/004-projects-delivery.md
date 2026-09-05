# Phase 004: Projects and Delivery

## Status

CLOSED / IMPLEMENTED (2026-09-05) — approved by the founder with the decisions recorded below, built, automated-and-live verified, hardened, and confirmed working end to end by the founder's own manual browser walkthrough.

**Build verification:** `npm run typecheck`/`lint`/`test` (137/137)/`build` all clean, live OpenRouter integration tests re-confirmed (Phase 002/003 regression), live RLS impersonation against the real database confirmed same-company resource-scoping (Contractor assigned to one project cannot see a second, unassigned project in their own company, not just cross-company), Contractor self-assignment denial, forged-UUID denial, child-table isolation, append-only `project_deliveries` immutability (even the founder's client role cannot alter a written delivery record — no UPDATE policy exists), `decisions.project_id` never bypassing existing Phase 003 decision RLS, and founder org-level access across all three test projects.

**Closure hardening (migration `0022_decision_project_integrity.sql`):** the one risk flagged at initial implementation — "`decisions.project_id`'s cross-company guard living only in application code, not a database constraint" — is now also a real database-level invariant. A `before insert or update` trigger (`enforce_decision_project_scope`) on `decisions` rejects any write where `project_id` is set to a project outside the decision's own `organisation_id`/`company_id`, independent of which code path performs the write (including a future service-role path that might omit the application check). Live-verified: a raw cross-company insert attempt, run as postgres (bypassing RLS and all application code), failed with the trigger's own exception; the equivalent same-company insert succeeded. Both fixtures cleaned up afterward.

**Manual browser verification (completed by the founder, 2026-09-05):** Orextic project creation, Orex Studios project creation, milestones, tasks and task completion, deliverables, readiness rejection while requirements are incomplete, successful `delivery_ready` transition after requirements are met, deliverable approval, delivery recording with immutable delivery history, scope change creation and approval, project membership add/remove, Contractor same-company project isolation, Viewer read-only behavior, project activity timeline, project-related decision linkage, audit events, and project archival with historical records preserved.

Founder decisions below supersede the originally-proposed sections they reference.

**Founder decisions (final, override conflicting parts of this document below):**

1. **Tasks**: included, per the exact lightweight field list the founder specified (§9, §12).
2. **Lifecycle vs. health kept separate**: lifecycle is `draft/planned/active/on_hold/review/delivery_ready/delivered/completed/cancelled/archived` — `at_risk` is a **health** state only, never a lifecycle status. Supersedes this document's originally-proposed lifecycle, which had folded `at_risk` into lifecycle (§7, §16).
3. **Delivery Ready model**: a relational `project_readiness_checks` table, not a `jsonb` array on `projects` — supersedes the originally-proposed jsonb design (§9, §15).
4. **Deliverables/delivery**: proceed as originally proposed (`project_deliverables` + append-only `project_deliveries`) — unchanged (§9, §14, §16).
5. **Client linkage**: `client_display_name` only — no `client_id` column of any kind in Phase 004. Supersedes the originally-proposed unconstrained `client_id uuid` column (§9, §18).
6. **Render Queue**: fully deferred, no tables — unchanged from the original proposal (§17).
7. **File storage**: deferred; `reference_url`/`reference_note` only, validated as well-formed URLs, **never fetched server-side** — unchanged in intent, with the explicit "never fetch server-side" constraint added (§26).
8. **Project activity**: proceed with a dedicated `project_activity` table, written alongside `audit_logs` for the same mutation, never used for authorization — unchanged from the original proposal (§9, §19).
9. **Decision integration**: reuse Phase 003's `decisions` table via a new **nullable `decisions.project_id` FK** — supersedes the originally-proposed `project_decisions` join table, which is **not created** (§20).
10. **Final table set**: `projects`, `project_members`, `project_milestones`, `project_tasks`, `project_deliverables`, `project_deliveries`, `project_scope_changes`, `project_readiness_checks`, `project_activity` (9 new tables) plus one modified existing table (`decisions` + nullable `project_id`). No `project_status_history`, no Render Queue tables, no Clients tables (§9, §10).
11. **Project membership / Contractor scope**: `project_members` may only restrict, never expand, access — company membership AND permission AND (for resource-scoped roles) explicit project membership must all hold. `roles.is_resource_scoped` defaults safely (`false`) for every existing role; only `contractor` is set `true` in this phase; Founder/Director/Manager/etc. behavior must be proven unaffected (§10, §23).
12. **Permissions**: reuse the six existing `projects.*` keys verbatim, with `projects.delete` kept **dormant** (never wired to an actual delete workflow — archival is a lifecycle transition, not `DELETE`). Add only the 8 previously-proposed `deliverables.*`/`scope_changes.*` keys, with the founder's specific role direction superseding this document's originally-proposed matrix (§22).
13. **Milestones/workflow**: no `workflow_templates`/`project_type_templates`/company-specific workflow tables — milestone titles and readiness checks are user-created data, not schema values — unchanged from the original proposal (§13).
14. **Scope changes**: proceed as originally proposed, with a `impact_summary` field (renamed from the original proposal's `impact` for clarity) — no finance/pricing mutation (§9, §14 combined into this section's design).
15. **AI**: fully deferred to Phase 007, no new task alias — unchanged from the original recommendation, now decided rather than merely recommended (§21).
16. **Project health**: manual/evidence-ready foundation only, no AI inference — unchanged from the original proposal, `at_risk` now confirmed as a health-only value per decision #2 (§8, §16).

Implementation proceeds under this approval. Sections below are updated in place to reflect these decisions; where an original section's design was superseded, the correction is noted inline rather than leaving stale text.

## 1. Objective

Give Orex Group companies a real operational execution layer: create a project, run it to completion, and know — at any moment — what it is, who owns it, where it stands, what's next, what's late or blocked, what changed, and whether it's actually ready to hand to the client. This is not a generic project-management product; it is the minimum structured truth Orex OS needs to eventually feed finance, client intelligence, and AI-assisted operations in later phases, built only as large as this phase genuinely requires.

## 2. Existing Phase 001/002/003 Foundation (verified against code)

**Phase 001** — reused as-is: `organisations`/`companies`/`company_members`/`organisation_members`/`roles`/`permissions`/`role_permissions` and their RLS helper functions `has_company_permission`/`has_org_permission`/`is_company_member` (migration `0006`); `lib/permissions/index.ts` (`hasPermission`, `hasOrgPermission`, `requirePermission`, `requireOrgPermission`, `requireScopedPermission`); `lib/audit` (`writeAuditLog`, redaction); `lib/auth/session` (`requireCurrentUser`); `lib/database/server` (`createServerSupabaseClient`, `createServiceRoleClient`); the `[companySlug]` route shell and nav (`app/(app)/[companySlug]/layout.tsx`), dense-table/form/badge UI conventions from `components/audit/AuditLogTable.tsx` and the Phase 003 `components/knowledge/*` components.

**Already seeded but unenforced since Phase 001 (confirmed in `lib/permissions/catalog.ts` and migration `0002`):** `projects.read`, `projects.create`, `projects.update`, `projects.delete`, `projects.assign`, `projects.approve` — with a full role matrix already committed (Founder/Director: all six; Manager/Project Manager: read+create+update+assign; Creative Lead: read+update; Member/Contractor/Viewer: read only). **Phase 004 does not need to seed or re-design this matrix — only enforce it against real tables for the first time**, exactly like Phase 002 did for the pre-seeded `ai.*` keys.

**Phase 002** — reused as-is, no changes anticipated: `lib/ai/gateway.ts`, `router.ts`, `sensitivity.ts`, `privacy.ts`, `redaction.ts`, `context-builder.ts`, `model-registry.ts`. No new task alias is proposed (see §21).

**Phase 003** — reused, not duplicated: `decisions`/`decision_reviews` tables and `app/actions/decisions.ts` (projects will *link to* decisions, never re-implement decision storage); `knowledge_items`/`knowledge_sources` and `lib/knowledge/retrieval.ts` (projects will *link to* knowledge and may later become a `knowledge_sources.source_type`, already reserved as `'project'` in the Phase 003 migration — no schema change needed there); `docs/permissions.md`'s founder-approved pattern of a small, explicit permission catalog with RLS mirroring server checks exactly.

**Confirmed absent from the codebase (inspected directly, not assumed):** no `projects`, `clients`, or any operational table exists yet; no Supabase Storage bucket or `@supabase/storage-js` usage anywhere; no render/job table; `docs/data-model.md`'s "Future Entities" list is the only prior artifact, and it is conceptual only.

## 3. Current Project/Delivery State

Zero. No project, milestone, deliverable, or delivery record exists anywhere in the database or code today.

## 4. Scope

- `projects` as the operational source of truth (identity, company/org ownership, lifecycle status, health, timeline, ownership, scope summary — see §9).
- `project_members` — an additional, narrower access restriction on top of (never a replacement for) company-level authorization, specifically to make Contractor project-scoping real for the first time.
- `project_milestones` — reusable, company-agnostic milestone records (no Orextic/Orex Studios-specific schema).
- `project_tasks` — a deliberately lightweight task list (see §12 for the recommendation and rationale).
- `project_deliverables` and `project_deliveries` — first-class deliverable records with a separate, append-only delivery history (mirrors the `decisions`/`decision_reviews` split from Phase 003).
- `project_scope_changes` — a scope-change log with an approval state.
- `project_activity` — a lightweight, user-facing operational timeline, explicitly distinct from `audit_logs`.
- A minimal, reusable Delivery Ready model (see §15) — no hard-coded per-company-type checklist in the schema.
- New permissions for deliverables and scope changes only (see §22) — everything else reuses the Phase 001 catalog.
- New RLS covering all new tables, including the new project-membership resource-scoping rule.
- A compact `/projects` and `/projects/[projectId]` UI, plus a small `/delivery-ready` view.
- Minimal, safe client linkage that Phase 005 can extend without a rework (see §18).
- Delivery references as safe links/metadata — no file upload/storage in this phase (see §26).

## 5. Out of Scope

Full Clients system (Phase 005); Finance/invoicing/payments; Calendar/meetings; autonomous AI project manager; full Founder Advisor; full render-farm orchestration or Blender integration; automated rendering; client portal; automated client communication/email delivery automation; complex task dependencies, sprints, story points, time tracking, employee performance scoring; automatic pricing or finance mutation; external PM-tool integrations; an asset DAM system; agent scheduling. Also explicitly deferred by this specification's own analysis: a persistent per-project-type checklist template system (§15), full file/asset storage (§26), and any user-facing AI project intelligence beyond what already exists (§21 — recommends deferring entirely to Phase 007).

## 6. Project Architecture

```
projects (company or, rarely, group-scoped like Phase 003's knowledge_items)
  ├─ project_members        -- who has resource-scoped access + role-in-project
  ├─ project_milestones      -- ordered, reusable gates
  ├─ project_tasks           -- lightweight next-actions, optionally tied to a milestone
  ├─ project_deliverables
  │    └─ project_deliveries -- append-only "what was delivered, when, by whom"
  ├─ project_scope_changes
  └─ project_activity        -- operational timeline (not audit_logs)

Cross-references (no new tables):
  projects.related_decision_ids  -- via a join table, see §20 -- reuses Phase 003 decisions
  knowledge_sources.source_type = 'project'  -- already reserved in Phase 003's migration
```

Every table follows the same authorization shape already established in Phases 001–003: `company_id` (nullable only on `projects` itself, for the rare group-level project — see §9), RLS via a new `has_project_access()` helper (§23) that composes the existing `has_company_permission`/`has_org_permission` functions rather than reimplementing membership resolution, and server actions that re-check permission before every mutation regardless of what RLS would also enforce.

## 7. Project Lifecycle

**Corrected per founder decision #2**: ten statuses, `at_risk` is a health value only (§8), never a lifecycle status. `review` is a real, distinct lifecycle stage (internal/client review before declaring delivery-ready) — not folded into anything else, per the founder's explicit approved lifecycle list.

```
draft → planned → active ⇄ on_hold
                     ↕
                   review
                     ↓
              delivery_ready → delivered → completed
                     ↓
                 cancelled (from any non-terminal state)
                     ↓
                 archived (terminal, from completed or cancelled only)
```

Valid transitions are enforced by one server-side function (`lib/projects/lifecycle.ts`, new) — never a client-supplied target status trusted directly:
- `draft → planned → active`: forward-only, no skipping.
- `active ⇄ on_hold`: reversible.
- `active ⇄ review`: reversible (sent back from review if not ready).
- `active/review → delivery_ready`: **gated** — only reachable when the readiness check in §15 passes; this is what "delivery_ready must not be reachable through a generic project update" means structurally — there is no generic `updateProject({ status: 'delivery_ready' })` path, only the dedicated `markDeliveryReady()` action that runs the check as part of the same transaction as the status write.
- `delivery_ready → delivered`: requires at least one `project_deliveries` row to exist.
- `delivered → completed`: a deliberate final wrap-up step, never automatic.
- `* → cancelled`: allowed from any non-terminal state, requires a reason (stored on `project_activity`).
- `completed/cancelled → archived`: terminal in this phase (no unarchive UI/action yet — the row is never deleted, so nothing is lost, but reactivating an archived project is deferred rather than half-built).

**Permission gating per founder decision #12** (`projects.delete` stays completely dormant — never wired to any transition, including archival): every ordinary transition (`draft→planned`, `planned→active`, `active⇄on_hold`, `active⇄review`, `*→cancelled`, `completed/cancelled→archived`) requires `projects.update` only. The three trust-weighted transitions the founder specifically named — into `delivery_ready`, into `delivered`, and into `completed` — additionally require `projects.approve`. Every transition writes one `project_activity` row (`project.status_changed`) and one `audit_logs` row (`project.status_changed`) regardless of which permission gated it.

## 8. Project Health (foundation only)

Four states: `healthy`, `attention`, `at_risk`, `blocked` — stored as `projects.health_state`, fully independent of `projects.status` (a project can be `active` and `attention`, or `review` and `at_risk`, simultaneously — status is lifecycle position, health is how it's going). **Confirmed by founder decision #2/#16: `at_risk` exists only here, never as a `projects.status` value.**

Structurally separates three things, per the founder's explicit instruction not to let AI silently assert health as fact:
- **System evidence** — computable facts: an overdue `project_tasks`/`project_milestones` row, an unresolved blocking `project_scope_changes` row, a deliverable stuck in `rejected`. Phase 004 computes these signals on read (a view/query, not a stored derived table) — no background job.
- **AI recommendation** — deferred to Phase 007 per §21; the schema reserves `projects.health_state_source` (`'human'` | `'system_signal'` | `'ai_recommended'`) so a future phase can attach AI-suggested health without a migration, but Phase 004 itself never writes `'ai_recommended'`.
- **Human-confirmed state** — `projects.health_state` is always set by a human via `updateProjectHealth()`, optionally informed by the system-evidence signals surfaced in the UI, but never auto-applied.

No predictive intelligence, no scoring algorithm — Phase 004 surfaces the raw signals (overdue count, blocking scope changes, rejected deliverables) in the UI next to the health picker; a human reads them and picks a state.

## 9. Data Model

Nine new tables (per founder decision #10) plus one modified existing table (`decisions` + nullable `project_id`, decision #9). Each new table is justified individually; alternatives considered and rejected are noted so a reviewer doesn't have to re-derive them.

### `projects`
```
id                 uuid pk
organisation_id    uuid not null references organisations(id)
company_id         uuid references companies(id)        -- null = rare group-level project (e.g. an internal Orex Group initiative); the overwhelmingly common case is company-scoped
name               text not null
project_code       text not null                          -- human-readable (e.g. "OS-2026-014"), NOT unique/security-relevant -- see note below
project_type       text not null                          -- free text, company-specific vocabulary (e.g. "3d_animation", "website"); NOT an enum, so Orextic/Orex Studios never share or fight over a fixed list
status             text not null default 'draft' check (status in (
                     'draft','planned','active','on_hold','review',
                     'delivery_ready','delivered','completed','cancelled','archived'))
health_state       text not null default 'healthy' check (health_state in ('healthy','attention','at_risk','blocked'))
health_state_source text not null default 'human' check (health_state_source in ('human','system','ai_recommended'))
priority           text not null default 'normal' check (priority in ('low','normal','high','urgent'))
owner_id           uuid references user_profiles(id)      -- accountable owner (often a Director/Manager)
lead_id            uuid references user_profiles(id)      -- day-to-day project lead (often the same person, sometimes not)
client_display_name text                                  -- see section 18 -- founder decision #5: display-only, no client_id column of any kind in Phase 004
description        text
scope_summary      text
objectives         text
start_date         date
target_date        date
delivered_at       timestamptz
completed_at       timestamptz
internal_notes_classification text not null default 'internal'
                     check (internal_notes_classification in ('internal','confidential','restricted'))
delivery_ready_confirmed_by uuid references user_profiles(id)
delivery_ready_confirmed_at timestamptz
created_by         uuid references user_profiles(id)
created_at         timestamptz not null default now()
updated_at         timestamptz not null default now()
```
**Corrected per founder decision #2**: `status` check constraint uses `review`, never `at_risk` (health-only, see §8). **Corrected per founder decision #5**: no `client_id` column of any kind — `client_display_name` only; Phase 005 adds a real `client_id → clients.id` FK as its own migration once the Clients model exists, with no Phase 004 column to migrate away from. **Corrected per founder decision #3**: no `delivery_readiness_checks` jsonb column — readiness is the separate relational `project_readiness_checks` table below.

**Project codes are not the security boundary** (founder's explicit instruction): `project_code` has no unique constraint and is never used in any RLS policy or permission check — only `id` (uuid) is. A guessed or duplicated code cannot be used to access a project; it's a display/reference convenience only.

### `project_members`
```
id            uuid pk
project_id    uuid not null references projects(id) on delete cascade
user_id       uuid not null references user_profiles(id)
project_role  text not null check (project_role in ('owner','lead','member','contractor'))
status        text not null default 'active' check (status in ('active','removed'))
added_by      uuid references user_profiles(id)
added_at      timestamptz not null default now()
removed_at    timestamptz
removed_by    uuid references user_profiles(id)
unique (project_id, user_id) -- one row per (project, user); status transition, not a new row, on removal (matches company_members' partial-unique-index pattern, but simpler since a project has no "re-invite" flow to worry about)
```
**Why needed, not optional:** this is the one genuinely new authorization primitive Phase 004 requires. Without it, "a contractor may be restricted to explicitly assigned projects" (the founder's explicit requirement) is unimplementable — `company_members` alone can only express company-wide access. See §10 and §23 for how this composes with, rather than replaces, company-level permission.

### `project_milestones`
```
id             uuid pk
project_id     uuid not null references projects(id) on delete cascade
title          text not null
description    text
owner_id       uuid references user_profiles(id)
status         text not null default 'pending' check (status in ('pending','in_progress','completed','blocked','skipped'))
sequence       integer not null
is_blocking    boolean not null default false   -- a blocking milestone must complete before delivery_ready is reachable (feeds the readiness check, §15)
due_date       date
completed_at   timestamptz
created_at     timestamptz not null default now(),
updated_at     timestamptz not null default now()
```
Deliberately generic (no `milestone_type` enum) — "Brief approved," "Storyboard approved," "Discovery complete," "Launch" are all just rows with different `title` text, created ad hoc per project by whoever's running it. No per-company template system in Phase 004 (see Open Questions §38.10 for whether this is worth adding later).

### `project_tasks`

**Decided (founder decision #1)**, exact field list as specified:
```
id                 uuid pk
project_id         uuid not null references projects(id) on delete cascade
milestone_id       uuid references project_milestones(id)   -- nullable; a task need not belong to a milestone
title              text not null
description        text
status             text not null default 'todo' check (status in ('todo','in_progress','done','blocked'))
priority           text not null default 'normal' check (priority in ('low','normal','high','urgent'))
assignee_user_id   uuid references user_profiles(id)
due_date           date
completed_at       timestamptz
created_by         uuid references user_profiles(id)
created_at         timestamptz not null default now(),
updated_at         timestamptz not null default now()
```
No subtasks, dependencies, recurrence, sprints, story points, estimates, time tracking, custom workflow engines, or templates — exactly the founder's exclusion list, nothing added.

### `project_deliverables`
```
id                uuid pk
project_id        uuid not null references projects(id) on delete cascade
title             text not null
description       text
deliverable_type  text not null    -- free text (e.g. "final_render", "design_file", "report") -- not an enum, same reasoning as project_type; flexible enough to represent a future render-related deliverable without a schema change (founder decision #6)
is_required        boolean not null default true    -- feeds the readiness check, §15: a deliverable explicitly marked optional does not block delivery_ready
status            text not null default 'in_progress' check (status in ('in_progress','internal_review','client_review','approved','rejected'))
owner_id          uuid references user_profiles(id)
version           text                          -- free text (e.g. "v3", "2026-09-05-final") -- not a strict semver requirement
due_date          date
approval_state    text not null default 'pending' check (approval_state in ('pending','approved','rejected'))
approved_by       uuid references user_profiles(id)
approved_at       timestamptz
reference_url     text                          -- safe external link (Drive/Frame.io/etc.) -- see section 26; validated as well-formed URL shape only, never fetched server-side
reference_note    text
notes             text
created_at        timestamptz not null default now(),
updated_at        timestamptz not null default now()
```

### `project_deliveries`
```
id                uuid pk
deliverable_id    uuid not null references project_deliverables(id) on delete cascade
delivered_by      uuid references user_profiles(id)
delivered_at      timestamptz not null default now()
version           text
destination       text    -- e.g. "client email", "client Drive folder", "staging URL"
reference_url     text
notes             text
created_at        timestamptz not null default now()
```
**Why a separate table instead of columns on `project_deliverables`:** a deliverable can legitimately be delivered more than once (a revision re-sent after client feedback) — overwriting delivery columns in place would lose that history, exactly the reasoning behind Phase 003's `decision_reviews` being separate from `decisions`. This is the same pattern, reapplied.

### `project_scope_changes`
```
id              uuid pk
project_id      uuid not null references projects(id) on delete cascade
summary         text not null
reason          text
impact_summary  text                              -- free text description of schedule/cost/scope impact (Phase 004 does not compute impact automatically, never touches finance/pricing)
requested_by    uuid references user_profiles(id)
approval_state  text not null default 'pending' check (approval_state in ('pending','approved','rejected'))
approved_by     uuid references user_profiles(id)
approved_at     timestamptz
is_blocking     boolean not null default false     -- an unresolved blocking scope change prevents delivery_ready, feeds §15
created_at      timestamptz not null default now()
```

### `project_readiness_checks`

**Decided (founder decision #3, supersedes the originally-proposed `jsonb` array)** — a relational table, checks created per project, remaining company-agnostic (no `workflow_templates`/`project_type_templates`):
```
id              uuid pk
organisation_id uuid not null references organisations(id)
company_id      uuid references companies(id)
project_id      uuid not null references projects(id) on delete cascade
title           text not null
description     text
is_required     boolean not null default true
status          text not null default 'pending' check (status in ('pending','complete','skipped'))
sequence        integer not null default 0
completed_by    uuid references user_profiles(id)
completed_at    timestamptz
evidence_note   text
created_by      uuid references user_profiles(id)
created_at      timestamptz not null default now(),
updated_at      timestamptz not null default now()
```
`organisation_id`/`company_id` are denormalized from the parent `projects` row (not strictly required for a join-based RLS policy, but kept for the same reason `knowledge_chunks`/`decision_reviews` in Phase 003 didn't need it yet Phase 004 chooses to include it here: it lets `has_project_access`-style policies avoid an extra join in the common case, and keeps this table independently auditable if a project row is ever inspected in isolation). The UI may suggest a default set of check titles per `project_type` as a **plain client-side constant**, never a database template — a project can freely diverge from the suggestion, and nothing server-side enforces "the" checklist for a given type.

### `project_activity`
```
id             uuid pk
project_id     uuid not null references projects(id) on delete cascade
actor_user_id  uuid references user_profiles(id)
event_type     text not null    -- 'project.created' | 'status_changed' | 'milestone.completed' |
                                 -- 'deliverable.created' | 'deliverable.approved' |
                                 -- 'scope_change.recorded' | 'delivery_ready' | 'delivered' | ...
summary        text not null    -- human-readable, e.g. "Status changed from active to at_risk"
metadata       jsonb
created_at     timestamptz not null default now()
```
**Why this exists separately from `audit_logs`:** `audit_logs` is security/compliance history, has no client-facing SELECT beyond `audit.read`, and its schema (before/after state, approval status, AI session id) is shaped for that purpose. `project_activity` is a distinct, smaller, purely operational feed shaped for "what happened on this project" — the founder's explicit instruction. Both are written by the same server action for the same event (e.g. a status change writes one `audit_logs` row and one `project_activity` row), never one replacing the other.

**Rejected, per founder decision #10:**
- **`project_status_history`** — a status change is just one `project_activity.event_type` value; a dedicated table would duplicate `project_activity`'s purpose for no query benefit Phase 004 actually needs.
- **A `project_decisions` join table** — superseded by a nullable `decisions.project_id` FK instead (§20).
- **A dedicated Render Queue table** — explicitly deferred, see §17.
- **A Clients table** — owned by Phase 005, not created here.

## 10. Project Membership

`project_members` is an **additional restriction**, never a grant beyond what company membership already allows — this is the exact rule the founder stated and it is enforced structurally in `has_project_access()` (§23), not just by convention: a user with no `company_members` row (or no relevant permission) in the project's company is denied regardless of any `project_members` row. Conversely, most roles (Founder, Director, Manager, Project Manager, Creative Lead, Member) see and act on **every project in their company** they already have `projects.read`/`.update`/etc. for — `project_members` rows are optional metadata (who's the owner/lead/team) for them, not a gate.

The gate applies only to roles marked `roles.is_resource_scoped = true` (a new column, set `true` only for `contractor` in Phase 004 — see §23) — for those roles, `has_project_access()` additionally requires an active `project_members` row on that exact project. A contractor cannot grant themselves membership: the `project_members` INSERT policy requires `projects.assign`, which Contractor does not hold in the existing Phase 001 matrix — this denial falls out of the existing permission catalog with zero new logic.

## 11. Milestones

Covered in §9. Sequencing (`sequence` integer) drives default UI ordering; `is_blocking` feeds the delivery-readiness check (§15) — an incomplete blocking milestone prevents the `delivery_ready` transition. `milestone.completed` writes both an audit event and a `project_activity` row.

## 12. Tasks Decision

**Decided (founder decision #1): included**, exact field list per §9. Gated by `projects.read`/`projects.update` for the general case (no new permission keys), **with one narrow, deliberate exception**: a task's own `assignee_user_id` may update that task's `status`/`completed_at` fields alone even without holding `projects.update`, provided they still pass `has_project_access(project_id, 'projects.read')`. This is the concrete case the founder's permission direction anticipated ("Contractor... may update only explicitly permitted assigned operational work") — implemented as a narrow server-action path (`completeTask`/`updateTaskStatus`, distinct from the general `updateTask` action), not a new permission key, per the founder's instruction not to create a separate task permission family unless the existing ones can't safely express the workflow. RLS permits both paths (`has_project_access(project_id,'projects.update')` OR `assignee_user_id = auth.uid()`); the server action is what narrows the assignee path to status-only fields — the same "RLS is the floor, the server action picks the narrower path" idiom already used by Phase 001's `company_members_update` policy.

## 13. Scope Changes

Covered in §9. `project_scope_changes.approval_state` transitions require `scope_changes.approve` (new permission, Founder/Director/Manager, per §22's founder-directed matrix — a superset of the originally-proposed Founder/Director-only). Phase 004 does not touch finance in any way when a scope change is recorded or approved — `impact_summary` is a free-text field for a human to describe, not a computed dollar amount; Phase 006 can read this table without Phase 004 needing to anticipate its shape.

## 14. Deliverables

Covered in §9. `approval_state` (`pending`/`approved`/`rejected`) is distinct from `status` (`in_progress`/`internal_review`/`client_review`/`approved`/`rejected`) — `status` tracks where the deliverable is in its own workflow; `approval_state` is the specific gate the delivery-readiness check (§15) reads. `deliverables.approve` (new permission) is required to set `approval_state = 'approved'`; `deliverables.deliver` (new permission) is required to insert a `project_deliveries` row — this is the founder's explicit "final project delivery should require `deliverables.deliver` and the appropriate project access." No credentials, passwords, or secrets are ever stored on a deliverable — `reference_url`/`reference_note` point to where the actual file lives (§26), and the server never fetches an external `reference_url` itself (founder decision #7).

## 15. Delivery Ready

**Corrected per founder decision #3**: readiness is checked against the relational `project_readiness_checks` table (§9), not a `jsonb` array. A project's `status` can transition to `delivery_ready` only through one server action, `markDeliveryReady()`, which:
1. Requires `projects.update` **and** `projects.approve` (per §22/§7 — one of the three trust-weighted transitions the founder specifically named).
2. Runs the readiness check, atomically with the status write:
   - every `project_readiness_checks` row with `is_required = true` must have `status = 'complete'`;
   - every `project_milestones` row with `is_blocking = true` must be `completed`;
   - every `project_scope_changes` row with `is_blocking = true` must have `approval_state != 'pending'`;
   - every `project_deliverables` row with `is_required = true` must have `approval_state = 'approved'`.
3. If any condition fails, the transition is rejected with a typed error enumerating exactly which checks/milestones/scope-changes/deliverables are still outstanding — never a silent no-op or a partial state change.
4. On success, records `delivery_ready_confirmed_by`/`_at`, writes `project.status_changed`/`delivery_ready` to both `audit_logs` and `project_activity`.

There is no generic `updateProject({ status: 'delivery_ready' })` path — `markDeliveryReady()` is the only route to that status, which is what "delivery_ready must not be reachable through a generic project update" means structurally, not just as a validation rule layered on top of a shared endpoint. `project_readiness_checks` rows are created ad hoc per project (optionally pre-filled from a plain client-side suggested-titles constant keyed by `project_type` — never a database template, per founder decision #13).

## 16. Delivery History

Covered in §9 (`project_deliveries`). A project's own `delivered_at`/`status = 'delivered'` reflects the project-level milestone of "we have delivered something meaningful to the client"; the per-deliverable `project_deliveries` rows are the actual audit-able record of what/when/who/version/destination. No client portal, no automated email — delivery is always recorded by a human after doing it, per the explicit Out of Scope instruction.

## 17. Render Queue Decision

**Deferred entirely to a future focused phase.** Adding `render_jobs` (job/project/deliverable relation, status, priority, assigned machine/user, frame-range metadata, submitted/completed timestamps) plus its own UI would be a genuine, material scope increase on top of the eight tables already justified above — exactly the condition under which the founder's brief says to defer rather than fold it in "if justified." The only forward-compatible hook Phase 004 leaves in place: `project_deliverables.deliverable_type` is free text, so a future Render Queue phase can use `deliverable_type = 'render'` as a natural join point without any Phase 004 schema change to undo.

## 18. Client Linkage Decision

**Corrected per founder decision #5**: no `client_id` column of any kind — not even an unconstrained reserved one. Phase 004 adds exactly one column to `projects`: `client_display_name text`, free-text, shown in the UI today (e.g. "Acme Corp"), with no relational integrity and no reserved-but-unused UUID semantics. Phase 005 adds the real `client_id → clients.id` FK as its own migration once the Clients model exists; because Phase 004 never introduces a `client_id` column at all, Phase 005 has nothing to backfill, reconcile, or migrate away from — it simply adds a new column. This is a stricter, cleaner version of the "temporary approach" originally proposed, per the founder's explicit instruction not to create dangling UUID semantics now.

## 19. Project Activity

Covered in §9. Event list (per founder decision #8 and §18 of the founder's message): `project.created`, `status_changed`, `health_changed`, `milestone.completed`, `task.completed`, `deliverable.created`, `deliverable.approved`, `scope_change.recorded`, `scope_change.approved`, `readiness_check.completed`, `delivery_ready`, `delivered`, `member.added`, `member.removed`. Deliberately excludes noisy events (field-level edits, page views, searches, filters, ordinary reads) — matches the founder's explicit instruction. **`project_activity` is never used as an authorization source** — every permission/RLS check reads `company_members`/`organisation_members`/`project_members`/`role_permissions` only, never this table.

## 20. Company Brain / Decision Integration

**Corrected per founder decision #9, supersedes the originally-proposed `project_decisions` join table (not created):** a new nullable `decisions.project_id uuid references projects(id) on delete set null` column. A decision is either company/group-level (`project_id is null`, unchanged Phase 003 behavior) or project-related (`project_id` set) — never both a join-table row and a column, avoiding two ways to express the same relationship. `on delete set null` (not `cascade` or `restrict`) because a decision's value as company knowledge outlives the project it was made on — archiving or otherwise ever removing a project row must never take a decision down with it.

**No RLS change to `decisions` is required or made**: its existing Phase 003 policies (`has_company_permission`/`has_org_permission` against `decisions.company_id`/`organisation_id`) are unchanged and still the only gate — `project_id` is descriptive metadata, not a new access path. This is what satisfies the founder's explicit warning: "project membership alone must not grant broader access to unrelated Company Brain decisions." Concretely: `has_project_access()` is never referenced by any `decisions` policy, and no decision becomes visible to a user solely because they have `project_members` access to the linked project — they still need `decisions.read` at the decision's own company/organisation scope, exactly as before Phase 004 existed.

Linking (`app/actions/project-decisions.ts`, `linkDecisionToProject`/`unlinkDecisionFromProject`) requires the caller to independently hold both `has_project_access(projectId, 'projects.update')` and the existing Phase 003 `decisions.update` at the decision's own scope, **and** validates that the decision's `company_id`/`organisation_id` matches the project's — a cross-company link attempt is rejected at the application layer even though no RLS rule technically prevents the column value itself from being set cross-company (the FK alone doesn't know about company boundaries). If implementation reveals this single-project-per-decision model is genuinely insufficient (a decision that legitimately spans multiple projects), this specification's instruction is to stop and report it rather than silently adding a join table — no such case is anticipated for Phase 004's scope.

**Knowledge**: no automatic promotion. `knowledge_sources.source_type = 'project'` already exists in the Phase 003 schema (reserved, unused). Phase 004 does not write to it automatically — a human who wants to turn a project lesson into company knowledge still goes through the existing Phase 003 "paste text" or manual-entry flow in `/brain`, optionally noting the project as context in the free-text content. Wiring an automatic `knowledge_sources` row per project is deferred — it's a genuine feature (deciding *which* project events are worth promoting) that AGENTS.md's "no automatic permanent company-memory updates" principle argues against building reflexively here.

## 21. AI Integration

**Decided (founder decision #15): fully deferred to Phase 007.** No AI project summaries, health scoring UI, task management, milestone generation, project-manager automation, or autonomous status changes. No new task alias added. `projects.health_state_source` (§8) reserves `'ai_recommended'` for that future phase without needing a migration; Phase 004 itself never writes it.

## 22. Permissions

**Reused as-is (already seeded, Phase 001, migration `0002`), enforced against real tables for the first time:** `projects.read`, `projects.create`, `projects.update`, `projects.assign`, `projects.approve`. **`projects.delete` stays completely dormant per founder decision #12** — it is not wired to archival or anything else in Phase 004; archival is an ordinary lifecycle transition gated by `projects.update` (§7).

**Deliberately not added, folded into existing keys instead** (avoiding the permission explosion the founder explicitly warned against):
- Milestones: gated by `projects.read`/`projects.update`.
- Tasks: gated by `projects.read`/`projects.update`, with the one narrow assignee-self-service exception described in §12 (no new permission key).
- Project membership management: gated by `projects.assign` (already exists, already excludes Contractor).

**New keys, minimal set for the two genuinely distinct trust surfaces (deliverables, scope changes):**
```
deliverables.read
deliverables.create
deliverables.update
deliverables.approve
deliverables.deliver

scope_changes.read
scope_changes.create
scope_changes.approve
```

**Founder-directed role matrix (§12 of the founder's message), supersedes this document's originally-proposed matrix:**

| Permission | Founder | Director | Manager | Project Mgr | Creative Lead | Member | Contractor | Viewer |
|---|---|---|---|---|---|---|---|---|
| deliverables.read | ● | ● | ● | ● | ● | ● | ● (scoped) | ● |
| deliverables.create | ● | ● | ● | ● | ● | ● | | |
| deliverables.update | ● | ● | ● | ● | ● | ● | | |
| deliverables.approve | ● | ● | ● | ● | ● | | | |
| deliverables.deliver | ● | ● | ● | ● | | | | |
| scope_changes.read | ● | ● | ● | ● | ● | ● | ● (scoped) | ● |
| scope_changes.create | ● | ● | ● | ● | ● | ● | | |
| scope_changes.approve | ● | ● | ● | ● | | | | |

Reasoning tying this to the founder's exact wording: Founder/Director/Manager/Project Manager get "all" of the new keys (Project Manager explicitly "all Phase 004 operational permissions except any organisation-only administration" — there is no such administration permission among these eight, so Project Manager receives all eight). Creative Lead gets `deliverables.{read,create,update,approve}` and `scope_changes.{read,create}` but explicitly not `deliverables.deliver` or `scope_changes.approve` ("no final deliverables.deliver by default, no scope_changes.approve by default"). Member gets `deliverables.{read,create,update}` and `scope_changes.{read,create}` but never approve/deliver. Contractor gets only scoped read on both (never approve scope, never approve or deliver final deliverables) — resource-scoped via `has_project_access()` exactly like `projects.read` already is. Viewer is read-only on both. `deliverables.deliver` — "final project delivery" — is deliberately the narrowest row (Founder/Director/Manager/Project Manager only), matching the founder's instruction that it "should require `deliverables.deliver` and the appropriate project access," and the project-level `delivery_ready`/`delivered`/`completed` transitions additionally require `projects.approve` (§7).

## 23. RLS

One new SQL primitive, `has_project_access(target_project_id uuid, permission_key text)`, composing the existing helpers rather than reimplementing membership resolution:

```sql
create or replace function public.has_project_access(target_project_id uuid, permission_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from projects p
    join company_members cm on cm.company_id = p.company_id
    join roles r on r.id = cm.role_id
    join role_permissions rp on rp.role_id = r.id
    join permissions perm on perm.id = rp.permission_id
    where p.id = target_project_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and perm.key = permission_key
      and (
        not r.is_resource_scoped
        or exists (
          select 1 from project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid() and pm.status = 'active'
        )
      )
  )
  or exists ( -- organisation-level grant path, e.g. founder -- same shape as has_company_permission
    select 1
    from projects p
    join organisation_members om on om.organisation_id = p.organisation_id
    join role_permissions rp on rp.role_id = om.role_id
    join permissions perm on perm.id = rp.permission_id
    where p.id = target_project_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and perm.key = permission_key
  );
$$;
```

`roles.is_resource_scoped boolean not null default false` is a new column (migration), set `true` only for `contractor` in Phase 004. This is chosen over hardcoding `role.key = 'contractor'` inside the SQL function, per the existing permission-model philosophy (`docs/permissions.md`: "Server code checks permissions by key... never by role name") — extending resource-scoping to a future role later is a data change, not a function rewrite.

Every project table's RLS policy calls `has_project_access(project_id, '<permission>')` (tables like `project_members`/`project_milestones`/`project_tasks`/`project_deliverables`/`project_scope_changes`/`project_readiness_checks`/`project_activity` carry their own `project_id` column directly; `project_deliveries` joins back one level further to `project_deliverables.project_id`, mirroring Phase 003's `knowledge_chunks` pattern exactly). `project_members` itself is gated on `projects.assign` for INSERT/UPDATE and `projects.read` for SELECT (via `has_project_access`, so a resource-scoped Contractor can see their own membership row but not enumerate every project's membership). `decisions` keeps its unmodified Phase 003 RLS regardless of `project_id` (§20) — `has_project_access` is never referenced by any `decisions` policy.

## 24. Audit

New audit actions, written via the existing `writeAuditLog()`, alongside (never instead of) the `project_activity` row for the same event:
```
project.created / project.updated / project.status_changed / project.archived
project_member.added / project_member.removed
milestone.created / milestone.completed
deliverable.created / deliverable.updated / deliverable.approved / deliverable.rejected
delivery.recorded
scope_change.created / scope_change.approved
project.delivery_ready
```
No secret values are logged (none exist on any Phase 004 table); `before_state`/`after_state` capture the relevant diff, redacted through the existing `redactSecrets` pass as a backstop, per Phase 003's precedent.

## 25. UI Requirements

Reuses the existing `[companySlug]` shell, dense-table pattern (`AuditLogTable`), badge conventions (Phase 003's `KnowledgeStatusBadge`-style pills), and form pattern (`InviteForm`/`KnowledgeForm`) — no new visual system.

New routes:
```
app/(app)/[companySlug]/projects/page.tsx           -- list: search, status filter,
                                                        health filter, owner filter,
                                                        priority, target date, dense table
app/(app)/[companySlug]/projects/[projectId]/page.tsx -- Overview (default tab)
app/(app)/[companySlug]/projects/[projectId]/milestones/page.tsx
app/(app)/[companySlug]/projects/[projectId]/tasks/page.tsx        -- if §12 confirmed
app/(app)/[companySlug]/projects/[projectId]/deliverables/page.tsx
app/(app)/[companySlug]/projects/[projectId]/scope/page.tsx
app/(app)/[companySlug]/projects/[projectId]/activity/page.tsx
app/(app)/[companySlug]/projects/[projectId]/team/page.tsx
app/(app)/[companySlug]/delivery-ready/page.tsx     -- cross-project view: every project
                                                        this user can see that is active/
                                                        at_risk/delivery_ready, with its
                                                        readiness-check status at a glance
```
Project Overview answers exactly the founder's ten questions (§"PROJECT OVERVIEW") using data already on the `projects` row plus small counts (open tasks, incomplete blocking milestones, pending scope changes) — no charts, no decorative widgets. Empty state: a single **+ New Project** action on the list page, and a creation form asking only for `name`, `company` (implicit from route), `project_type`, and optionally `client_display_name`/`owner_id`/`target_date` — everything else editable later, matching Phase 003's "smallest complete form" discipline.

## 26. Storage Decision

**Deferred — no Supabase Storage bucket in Phase 004.** Confirmed by inspection: no storage usage exists anywhere in the codebase today, so adding it would mean building bucket policies, signed-URL flows, and file-size/type validation from zero inside an already-large phase. `project_deliverables.reference_url`/`reference_note` and `project_deliveries.reference_url`/`destination` carry safe external links (Drive, Frame.io, a staging URL, etc.) — validated server-side as well-formed URLs only, never treated as a security boundary (no secret/token query params allowed in a stored URL, checked by the same secret-key-pattern redaction already used elsewhere). Full asset management (upload, private bucket, signed access) is deferred to a future focused pass once real usage patterns are clearer.

## 27. Validation

Zod schemas in `lib/validation/projects.ts` (new), following the exact pattern of `lib/validation/{knowledge,decisions}.ts`: one schema per server action input. `companyId`/`projectId`/`memberId`/`roleId`/any status or approval value arriving from the client is parsed for shape only — every one of them is re-resolved against real membership/permission state server-side before any mutation, identical to every prior phase's discipline. No server action trusts a client-supplied `status` transition without running it through the lifecycle validator (§7).

## 28. Database Migrations

```
0018_enable_project_resource_scoping.sql   -- roles.is_resource_scoped column + seed (contractor = true)
0019_projects_and_delivery.sql             -- 9 tables + has_project_access() + RLS
0020_project_permissions.sql               -- deliverables.*/scope_changes.* catalog + role matrix
0021_decisions_project_id.sql              -- nullable decisions.project_id FK + index (no RLS change)
0022_decision_project_integrity.sql        -- closure hardening: enforce_decision_project_scope() trigger
```
Split into five migrations for the same reason Phase 003 split pgvector/tables/permissions: each is independently reviewable and, if one reveals a problem, doesn't block re-review of the others. `0022` was added during closure, not the original approval, in direct response to Risk #4 below.

## 29. Files Expected to Create

```
supabase/migrations/0018_enable_project_resource_scoping.sql
supabase/migrations/0019_projects_and_delivery.sql
supabase/migrations/0020_project_permissions.sql
supabase/migrations/0021_decisions_project_id.sql
supabase/migrations/0022_decision_project_integrity.sql

lib/projects/
  lifecycle.ts            -- status-transition validator (section 7)
  lifecycle.test.ts
  readiness.ts            -- delivery-ready check against project_readiness_checks (section 15)
  readiness.test.ts
  activity.ts             -- writeProjectActivity() helper (mirrors lib/audit's shape)
  activity.test.ts
  types.ts

lib/validation/projects.ts

app/actions/projects.ts        -- createProject, updateProject, changeProjectStatus,
                                   updateProjectHealth, markDeliveryReady, archiveProject
app/actions/project-members.ts -- addProjectMember, removeProjectMember
app/actions/project-milestones.ts
app/actions/project-tasks.ts        -- includes the narrow assignee-self-service status update (section 12)
app/actions/project-readiness-checks.ts -- create/complete/skip
app/actions/project-deliverables.ts -- create/update/approve/reject
app/actions/project-deliveries.ts   -- recordDelivery
app/actions/project-scope-changes.ts -- create/approve/reject
app/actions/project-decisions.ts     -- linkDecisionToProject/unlinkDecisionFromProject (sets/clears decisions.project_id)

app/(app)/[companySlug]/projects/page.tsx
app/(app)/[companySlug]/projects/[projectId]/page.tsx
app/(app)/[companySlug]/projects/[projectId]/milestones/page.tsx
app/(app)/[companySlug]/projects/[projectId]/tasks/page.tsx
app/(app)/[companySlug]/projects/[projectId]/readiness/page.tsx
app/(app)/[companySlug]/projects/[projectId]/deliverables/page.tsx
app/(app)/[companySlug]/projects/[projectId]/scope/page.tsx
app/(app)/[companySlug]/projects/[projectId]/activity/page.tsx
app/(app)/[companySlug]/projects/[projectId]/team/page.tsx
app/(app)/[companySlug]/delivery-ready/page.tsx

components/projects/
  ProjectTable.tsx  ProjectForm.tsx  ProjectHealthBadge.tsx  ProjectStatusBadge.tsx
  MilestoneTable.tsx  MilestoneForm.tsx
  TaskTable.tsx  TaskForm.tsx                      -- if section 12 confirmed
  DeliverableTable.tsx  DeliverableForm.tsx  DeliveryForm.tsx
  ScopeChangeTable.tsx  ScopeChangeForm.tsx
  ProjectActivityFeed.tsx
  ProjectMemberTable.tsx  ProjectMemberForm.tsx
  DeliveryReadyChecklist.tsx
  ProjectDecisionLinker.tsx
```

## 30. Files Expected to Modify

`lib/permissions/catalog.ts` (+8 keys), `docs/permissions.md` (+matrix), `docs/data-model.md` (move projects/delivery tables from "Future Entities" to implemented), `app/(app)/[companySlug]/layout.tsx` (+Projects/Delivery Ready nav links), `.agents/skills/orex-rls-security/SKILL.md` (document `has_project_access()` and `is_resource_scoped` as a second reusable pattern alongside `has_company_permission`).

## 31. Security Requirements

Company isolation via the existing pattern, unchanged. Resource-scoping (`is_resource_scoped`) is additive-only — verified by construction: `has_project_access()` only *adds* a project-membership requirement on top of the company-permission check, never substitutes for it, so a bug here can make access too narrow (a real Contractor wrongly denied) but structurally cannot make it too broad. `project_code` never used in any authorization check (§9). No secrets/credentials on any Phase 004 table. `reference_url` fields validated as well-formed URLs, scanned by the existing secret-pattern redaction before any audit/activity write. No AI context assembly is added in this phase (§21 defers it) — if the founder requests the minimal capability instead, it must reuse the unmodified Phase 002/003 classification and `ai.use`-plus-`projects.read` discipline, never a new bypass.

## 32. Acceptance Criteria

1. A user with `projects.create` in Company A can create a project; a Company B-only user cannot see it via any UI path, direct query, or forged id.
2. A Contractor with `project_members` rows on Project X only sees Project X, not other company projects they'd otherwise have `projects.read` for — while every non-resource-scoped role sees all company projects it has permission for, with or without a `project_members` row.
3. A Contractor cannot insert their own `project_members` row (denied by the existing `projects.assign` gate, held by no Contractor role).
4. `delivery_ready` cannot be reached while any blocking milestone is incomplete, any blocking scope change is pending, or any non-optional deliverable is unapproved — attempting it returns a typed, specific error, not a silent failure or partial state change.
5. A deliverable requires `deliverables.approve` to move to `approval_state = 'approved'`, and a separate `deliverables.deliver` to record a `project_deliveries` row — a Manager (create/update only) can do neither.
6. Archiving is reversible and never physically deletes a project or any related row; every prior table's history remains queryable.
7. `project_activity` and `audit_logs` both receive independent rows for the same mutation — deleting/ignoring one never removes the other.
8. Founder (org-level grant) sees projects across both companies; a company-scoped Director does not see the other company's projects.
9. All 8 new permission keys appear in `docs/permissions.md`'s matrix and are enforced identically in RLS and server checks.
10. Full Phase 001, 002, and 003 test suites continue to pass unmodified.

## 33. Automated Tests

`lib/projects/lifecycle.test.ts` (every valid/invalid transition), `readiness.test.ts` (each blocking condition individually, and the all-clear case), `activity.test.ts` (writes alongside audit, never replacing it). `app/actions/projects.test.ts` and siblings for each new server action (permission denial, cross-company denial, resource-scoping denial, successful path with correct audit+activity writes). Live RLS tests (same impersonation technique as Phases 001–003, fixtures created and fully cleaned up): Orextic-only vs. Orex Studios-only isolation; Contractor scoped-vs-unscoped project access; forged project id on every new table; Viewer mutation denial; founder group access if a group-level project fixture is used.

## 34. Manual Tests

Create a project as each relevant role and confirm the create button/form only appears where permitted; assign a Contractor to one project and confirm they see only that one; attempt `delivery_ready` on a project with an incomplete blocking milestone and confirm the specific error; approve and then deliver a deliverable as Director; record a scope change and approve it; verify the Delivery Ready view lists exactly the projects the signed-in user can see; verify empty-state "+ New Project" works from zero data; confirm archiving hides a project from the default list but it remains reachable via an explicit filter.

## 35. Regression Tests

Full Phase 001 (org/company/permission/audit), Phase 002 (AI gateway, including the hardening pass's sensitivity enforcement and embedding usage tracking), and Phase 003 (Company Brain, decisions) suites re-run in full — none of their tables, functions, or code paths are touched by this phase except the additive `decisions.project_id` column (§20), which changes no existing policy.

## 36. Rollback Plan

All five migrations are additive only (new tables, one new column on `roles`, one new nullable column on `decisions`, new seeded permissions, one new trigger). Rollback is five reverse migrations in reverse order: drop the `decisions_project_scope_check` trigger and `enforce_decision_project_scope()`; drop `decisions.project_id`; delete the seeded `deliverables.*`/`scope_changes.*` permissions and their role mappings; drop the 9 new tables, `has_project_access()`, and their policies; drop the `roles.is_resource_scoped` column (only safe if no other feature has since depended on it — treat as effectively one-way once Phase 005+ ships, same caveat as Phase 003's `pgvector` extension). No Phase 001/002/003 table, function, or policy is altered.

## 37. Risks

1. **`is_resource_scoped` is a blunt, role-wide flag** — it can't yet express "this specific Manager is resource-scoped on this one project" (only "Contractors, as a role, always are"); fine for Phase 004's actual requirement, a real limitation if a future need for per-user resource-scoping outside the Contractor role emerges.
2. **`project_readiness_checks` has no per-project-type template** (by founder decision #13) — a project lead must remember to add the right checks each time; if this proves error-prone in practice, a future phase may need a real template table.
3. **The assignee-self-service task exception (§12)** is a narrow, deliberately manual carve-out rather than a general pattern — if more roles need similarly narrow self-service exceptions later, this should become a documented pattern in `orex-rls-security`, not repeated ad hoc.
4. ~~`decisions.project_id` cross-company link enforced only in the server action, not by a database constraint~~ — **resolved during closure.** Migration `0022_decision_project_integrity.sql` adds a database trigger (`enforce_decision_project_scope`) making this a real constraint, independent of any application code path. Live-verified: a raw cross-company insert attempt (run as postgres, bypassing RLS and application code entirely) was rejected by the trigger.

## 38. Open Questions

None outstanding — all resolved by the founder's approval decisions recorded in the Status section above.

## 39. Implementation Instructions

Migrations in the order §28 lists (resource-scoping column → core tables/RLS → permissions → `decisions.project_id`), then `lib/projects/*`, then server actions, then UI, running `npm run typecheck`/`lint`/`test`/`build` after each major slice. Full Phase 001+002+003 regression checks (§35) are required before this phase can be reported ready to close, matching every prior phase's closure discipline. Do not begin Phase 005.

Then stop.
