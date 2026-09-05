# Orex OS Permission Model

## Principles

One user identity. Authorization is always resolved server-side and re-enforced by the database (RLS). Permissions are granular, not just role names. Frontend hiding is convenience, never security. Every permission-relevant change is audited. Founder access is explicit, not a bypass.

## Authentication vs Authorization

Authentication (Supabase Auth) answers "who is this?". Authorization (this document, `lib/permissions/`, and RLS) answers "what can they do, where?". A verified session proves identity only; every subsequent read/write still resolves membership, role, and permission before proceeding.

## Organisation Scope

Group-wide access (Orex Group) is granted through `organisation_members` (see `docs/data-model.md`), not implied by any role name. Only the founder can grant it (`permissions.manage`), and it is revocable like any other membership.

## Company Scope

Most access is scoped to one company through `company_members`: one row per (company, user), one role, active/removed status.

## Resource Scope

Phase 001 does not implement resource-scoped (e.g., project-only) access — there is no `projects` table yet. The model reserves this for a future `project_members` mapping table (see `docs/data-model.md` Future Entities), which will add a third, narrower resolution step ("does this user have resource-specific access to this exact project") beneath the company-role step. A Phase 001 contractor's access is expressed as a Contractor role at the company level with a deliberately small permission set, not yet as true per-project scoping.

## Role Model

A role is a named bundle of permissions (`roles` + `role_permissions`). A membership (company or organisation level) references exactly one role in Phase 001. Roles are seeded system rows in Phase 001; custom role creation is out of scope.

## Permission Model

Permissions are atomic strings in `resource.action` form, stored in the `permissions` catalog and mapped to roles via `role_permissions`. Server code checks permissions by key (e.g. `hasPermission(userId, companyId, "finance.read")`), never by role name — this keeps checks stable even if role-to-permission mappings change later.

Phase 001 permission catalog:

```
companies.read
companies.create
companies.update
companies.manage

projects.read
projects.create
projects.update
projects.delete
projects.assign
projects.approve

clients.read
clients.create
clients.update
clients.delete

finance.read
finance.create
finance.update
finance.approve

transactions.read
transactions.create
transactions.update
transactions.approve

team.read
team.invite
team.update
team.remove

permissions.read
permissions.manage

reports.read
reports.create

ai.use
ai.approve
ai.manage

audit.read

settings.manage

secrets.read
secrets.reveal
secrets.manage
```

Phase 001 implements the catalog, the role mappings below, and enforcement for `companies.*`, `team.*`, `permissions.*`, `audit.read`, `settings.manage`. `projects.*` became enforced in Phase 004 (see "Phase 004 Permission Scope" below); `clients.*`, `finance.*`, `transactions.*`, `reports.*`, `secrets.*` remain seeded but unenforced (no tables to enforce against yet). `ai.*` became enforced in Phase 002; `knowledge.*`/`decisions.*` in Phase 003; `deliverables.*`/`scope_changes.*` in Phase 004.

## Default Roles

Founder, Director, Manager, Finance, Project Manager, Creative Lead, Member, Contractor, Viewer — see mapping below.

## Permission Matrix

Legend: ● = granted, blank = not granted. This is the Phase 001 default mapping; it governs both `company_members` roles and, where marked (Founder), `organisation_members`.

| Permission | Founder | Director | Manager | Finance | Project Mgr | Creative Lead | Member | Contractor | Viewer |
|---|---|---|---|---|---|---|---|---|---|
| companies.read | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| companies.create | ● | | | | | | | | |
| companies.update | ● | ● | | | | | | | |
| companies.manage | ● | | | | | | | | |
| projects.read | ● | ● | ● | ● | ● | ● | ● | ● (assigned projects only, since Phase 004) | ● |
| projects.create | ● | ● | ● | | ● | | | | |
| projects.update | ● | ● | ● | | ● | ● | | | |
| projects.delete | ● | ● | | | | | | | |
| projects.assign | ● | ● | ● | | ● | | | | |
| projects.approve | ● | ● | | | | | | | |
| clients.read | ● | ● | ● | ● | ● | ● | ● | | ● |
| clients.create | ● | ● | ● | | ● | | | | |
| clients.update | ● | ● | ● | | ● | | | | |
| clients.delete | ● | ● | | | | | | | |
| finance.read | ● | ● | | ● | | | | | |
| finance.create | ● | ● | | ● | | | | | |
| finance.update | ● | ● | | ● | | | | | |
| finance.approve | ● | ● | | | | | | | |
| transactions.read | ● | ● | | ● | | | | | |
| transactions.create | ● | ● | | ● | | | | | |
| transactions.update | ● | ● | | ● | | | | | |
| transactions.approve | ● | ● | | | | | | | |
| team.read | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| team.invite | ● | ● | | | | | | | |
| team.update | ● | ● | | | | | | | |
| team.remove | ● | ● | | | | | | | |
| permissions.read | ● | ● | | | | | | | |
| permissions.manage | ● | | | | | | | | |
| reports.read | ● | ● | ● | ● | ● | ● | | | |
| reports.create | ● | ● | ● | | ● | ● | | | |
| ai.use | ● | ● | ● | ● | ● | ● | ● | | |
| ai.approve | ● | ● | | | | | | | |
| ai.manage | ● | | | | | | | | |
| audit.read | ● | ● | | | | | | | |
| settings.manage | ● | | | | | | | | |
| secrets.read | ● | ● | | | | | | | |
| secrets.reveal | ● | | | | | | | | |
| secrets.manage | ● | | | | | | | | |

Contractor and Viewer are intentionally minimal: no finance, no secrets, no team management, no cross-company reach. This matrix is the source of truth the Phase 001 seed migration will encode into `role_permissions`.

## Founder Access

Founder access is granted via an `organisation_members` row with the Founder role (see `docs/data-model.md`). Permission checks for a founder still go through the same `hasPermission(userId, companyId, permissionKey)` function as anyone else — the function's company-resolution step simply also checks for an active `organisation_members` grant that covers the organisation the target company belongs to, in addition to a direct `company_members` row. There is no code path that returns "allow" purely because `user.role === 'founder'` without going through this resolution — removing the founder's `organisation_members` row immediately revokes group access, and every grant/removal is audited.

## Contractor Access

A Contractor's `company_members` role grants `companies.read`, `projects.read`, `deliverables.read`, `scope_changes.read`, `team.read`, `ai.use`. No finance, no secrets, no client mutation, no cross-company access. Since Phase 004, `projects.read` (and every other project-table permission) for Contractor is genuinely narrowed to explicitly assigned projects only — `roles.is_resource_scoped = true` for Contractor, enforced by `has_project_access()` requiring an active `project_members` row on the specific project in addition to the company-level grant (see "Phase 004 Permission Scope" below and `prompts/004-projects-delivery.md` section 23). This matches AGENTS.md's contractor example exactly: "Project A only" access is real, not aspirational.

## Project-Scoped Access

Not implemented in Phase 001 — see Resource Scope above. Documented here so the permission-resolution algorithm has a defined extension point.

## Finance Restrictions

`finance.*` and `transactions.*` permissions are catalog-only in Phase 001 (no finance tables exist yet). The role matrix above defines who *will* have finance access once the finance module ships, so that module doesn't need its own permission-design pass — it inherits this matrix.

## Secret Restrictions

`secrets.*` permissions are catalog-only in Phase 001 — no secrets vault exists yet (AGENTS.md §14 explicitly reserves that for its own feature). No AI, and no ordinary table, may hold secret values in any phase.

## AI Permission Rules

`ai.use`, `ai.approve`, `ai.manage` are catalog-only in Phase 001 — no AI integration exists yet (OpenRouter and Company Brain are explicitly out of scope). Reserved so Phase 002+ can attach directly to this permission model without a migration.

## External Communication Permissions

Not modeled in Phase 001 (no external communication feature exists). Future phases will likely add a `communications.send` permission gated behind explicit approval per AGENTS.md §10.

## Invitation Permissions

`team.invite` is required to create an invitation for a company. An inviter can only invite into a company they themselves hold `team.invite` for, and can only assign a role at or below their own privilege — enforced in Phase 001 by restricting the assignable-role list server-side to roles whose permission set is a subset of (or explicitly allowlisted against) the inviter's own, preventing privilege escalation via invitation.

## User Removal and Revocation

`team.remove` sets `company_members.status = 'removed'` (never a hard delete). A removed member immediately loses all access on their next request — the server-side permission check reads `status = 'active'` only, and RLS policies do the same, so even an in-flight session's next query is denied.

## Access Expiry

Invitations carry `expires_at`; an expired, unaccepted invitation cannot be used to register regardless of token validity — checked both in the acceptance server action and reflected in `status = 'expired'` (set lazily on read/accept attempt, not requiring a background job in Phase 001). Membership-level time-boxed access (e.g., a contractor's access auto-expiring on a date) is not implemented in Phase 001.

## Server-Side Permission Checks

A single helper, `hasPermission(userId, companyId, permissionKey)` (in `lib/permissions/`), is the only sanctioned way to check authorization in server actions/route handlers. It resolves: active `company_members` row for (userId, companyId) → role → role_permissions, OR an active `organisation_members` row covering that company's organisation → role → role_permissions. No handler queries `company_members`/`roles` directly to make an authorization decision.

## Database RLS Relationship

Every RLS policy on a company-scoped table encodes the same rule as the server-side check (active membership, or active organisation-level grant, with the required permission) using a `SECURITY DEFINER` SQL helper function mirroring `hasPermission`'s logic, so the two layers cannot silently diverge — see `.agents/skills/orex-rls-security/SKILL.md`.

## Frontend Visibility

The company switcher, nav items, and action buttons hide based on permissions for UX clarity only. Every hidden action's underlying server action independently re-checks the same permission — removing a button never becomes the actual control.

## Permission Evaluation Algorithm

```
authenticate (Supabase session)
→ resolve user_profiles row
→ resolve company (from request context, never trusted blindly — re-validated against real membership)
→ resolve role (via company_members, or organisation_members for group-level grants)
→ resolve permissions (via role_permissions)
→ optional resource access (future — project_members)
→ allow / deny
```

## Audit Requirements

Every `company_members`, `organisation_members`, and `role_permissions` change is audited (actor, before/after role or status, timestamp). Permission checks themselves are not audited (too high volume) — only the mutations that change what a permission check would return.

## Phase 001 Permission Scope

Full catalog seeded; full role matrix seeded; enforcement implemented for `companies.*`, `team.*`, `permissions.*`, `audit.read`, `settings.manage`. `clients.*`, `finance.*`, `transactions.*`, `reports.*`, `secrets.*` remain seeded but unenforced (no tables to enforce against yet). `ai.*` became enforced in Phase 002; `projects.*` in Phase 004 (see "Phase 004 Permission Scope" below).

## Phase 003 Permission Scope (implemented, CLOSED)

Nine new keys, enforced identically in both RLS and server-side checks (`.agents/skills/orex-rls-security/SKILL.md`'s discipline): `knowledge.read`, `knowledge.create`, `knowledge.update`, `knowledge.verify`, `knowledge.manage`, `decisions.read`, `decisions.create`, `decisions.update`, `decisions.review`.

| Permission | Founder | Director | Manager | Finance | Project Mgr | Creative Lead | Member | Contractor | Viewer |
|---|---|---|---|---|---|---|---|---|---|
| knowledge.read | ● | ● | ● | | ● | ● | ● | (scoped) | ● |
| knowledge.create | ● | ● | ● | | ● | ● | | | |
| knowledge.update | ● | ● | ● | | ● | ● | | | |
| knowledge.verify | ● | ● | | | | | | | |
| knowledge.manage | ● | ● | | | | | | | |
| decisions.read | ● | ● | ● | | ● | ● | ● | (scoped) | ● |
| decisions.create | ● | ● | ● | | ● | ● | | | |
| decisions.update | ● | ● | ● | | | | | | |
| decisions.review | ● | ● | ● | | | | | | |

## Phase 004 Permission Scope (implemented, CLOSED)

`projects.*` (six keys, seeded since Phase 001 — see the Phase 001 matrix above) became enforced for the first time against real tables. `projects.delete` stays completely dormant — never wired to any transition or server action; project archival is an ordinary lifecycle transition gated by `projects.update`, not a delete workflow.

Eight new keys: `deliverables.read`, `deliverables.create`, `deliverables.update`, `deliverables.approve`, `deliverables.deliver`, `scope_changes.read`, `scope_changes.create`, `scope_changes.approve`.

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

**New resource-scoping mechanism** (not present before Phase 004): `roles.is_resource_scoped` (default `false`, `true` only for `contractor`) plus a new RLS/server primitive, `has_project_access(projectId, permissionKey)`. For a resource-scoped role, every project-table permission check additionally requires an active `project_members` row on that exact project — company-level permission alone is necessary but no longer sufficient. This can only *narrow* access relative to the existing `has_company_permission` check, never widen it; non-resource-scoped roles (Founder, Director, Manager, Project Manager, Creative Lead, Member, Viewer) are unaffected and continue to see every project their company-level permission already allows. Live-verified: a Contractor assigned to one project cannot see a second, unassigned project in their own company. Full rationale in `prompts/004-projects-delivery.md` sections 10, 22, 23.

`knowledge.verify`, `knowledge.manage`, and `decisions.review` are high-trust, Founder/Director-only actions by design — turning AI-extracted or unverified knowledge into permanent company memory, or closing out a decision's review history, is a trust-weighted action. `ai.use` is checked in addition to `knowledge.read` for any AI-driven Company Brain feature (e.g. `askCompanyBrain`) — never as a substitute for it. Full rationale in `prompts/003-company-brain.md` section 19.

## Future Permission Extensions

Resource-scoped (project-level) access; custom (non-system) roles; time-boxed/expiring memberships; external-communication permissions.

## Security Risks

1. A permission-key typo between server check and RLS policy would silently create a gap in one layer while the other still holds — mitigated by generating both from the same seeded catalog and the shared SQL helper function described above.
2. An invitation that lets an inviter assign a role above their own would be a privilege-escalation path — explicitly disallowed above and must be enforced in the Phase 001 invitation-acceptance server action, not just the UI.

## Open Questions

1. Should the "assignable roles ≤ inviter's own privilege" rule (Invitation Permissions, above) be enforced by an explicit per-role rank ordering, or by a more precise "target role's permission set must be a subset of inviter's effective permission set" check? This document assumes the subset check as more correct; confirm before implementation if a simpler rank ordering is preferred.
2. Should Viewer get `ai.use`? Table above says no; confirm this matches founder intent once AI ships (does not block Phase 001, catalog-only).
