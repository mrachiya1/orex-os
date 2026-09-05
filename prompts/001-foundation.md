# Phase 001: Multi-Company Security Foundation

## Status

APPROVED (2026-09-05) — all Open Questions below resolved by the founder prior to implementation.

## Objective

Establish the multi-company security foundation Orex OS is built on: one Orex Group organisation, companies, a single user identity per person with per-company memberships and roles, a granular server-enforced + RLS-enforced permission system, invitation-based registration, a company switcher, an explicit (non-bypass) founder group-access mechanism, and an audit log foundation. No operational modules (projects, clients, finance, etc.), no AI, and no redesign of anything are in scope.

## Current Implementation

Per `docs/current-state-audit.md`: the repository is an unmodified Next.js 16 App Router + TypeScript + Tailwind v4 scaffold (`create-next-app` output). No Supabase connection, no auth, no database, no server actions/API routes, no components, no data model exist. `lib/{auth,permissions,audit,database,validation,ai,integrations}` and `components/` exist as empty directories. `supabase/config.toml`, `supabase/migrations/`, and `supabase/seed.sql` are placeholders with no real content. There is nothing to preserve from a product-feature standpoint; the toolchain (`package.json`, `tsconfig.json`, ESLint, Tailwind v4 config) should be preserved and built on, not replaced.

## Scope

- `organisations` (Orex Group, single row)
- `organisation_members` (explicit group-level access grants, incl. founder)
- `companies` (Orextic, Orex Studios, extensible)
- `user_profiles` (one per identity)
- `company_members` (per-company role assignment)
- `roles` (seeded system roles: Founder, Director, Manager, Finance, Project Manager, Creative Lead, Member, Contractor, Viewer)
- `permissions` (full catalog per `docs/permissions.md`, including keys unused until later phases)
- `role_permissions` (seeded per the Phase 001 matrix in `docs/permissions.md`)
- `invitations` (token-hashed, expiring, single-use, role-capped)
- `audit_logs` (append-only, actor/company/resource/action/before-after)
- Supabase project connection (client + server), Supabase Auth sign-in
- `lib/auth`, `lib/permissions`, `lib/audit`, `lib/database`, `lib/validation` implementations
- RLS policies for every table above
- Minimal UI: sign-in, authenticated shell, company switcher, company member list + invite + remove flows, invitation-acceptance page, audit log view
- Automated tests for permission helpers and validation; integration tests for the protected mutations in scope; manual security tests per `docs/security.md`

## Out of Scope

OpenRouter, Company Brain, AI agents, finance redesign, project redesign, client intelligence, calendar intelligence, risk engine, performance module, Builder Studio, any operational module beyond what's listed in Scope, custom (non-system) roles, resource/project-scoped permissions, MFA, rate limiting, secrets vault, file storage.

## User Stories

1. As the founder, I can sign in and see every company I have group-level access to, via an explicit, auditable grant.
2. As a Director, I can sign in and see only the company/companies I'm an active member of.
3. As a Director, I can invite a new user to my company with a role at or below my own privilege.
4. As an invited user, I can accept a valid, unexpired invitation and gain exactly the membership/role it specifies.
5. As a Contractor, I can read my company's data per my role's limited permission set, and cannot mutate anything finance- or team-related.
6. As a Viewer, I cannot create, update, or delete anything.
7. As a Director, when I remove a team member, they lose access immediately.
8. As a founder/director with `audit.read`, I can view the audit log for my company(ies).
9. As any authenticated user, I cannot access another company's data by editing request parameters (forged `company_id`), because the server re-derives my real membership and RLS enforces it independently.

## Technical Architecture

Per `docs/architecture.md`: Next.js App Router server components/actions call `lib/permissions.hasPermission(userId, companyId, key)` before any protected read/write; `lib/database` exposes a server Supabase client (using the verified session, RLS-scoped) and, only where unavoidable, a narrowly-used service-role client that still re-implements the permission check in code; `lib/validation` holds Zod schemas per mutation; `lib/audit` exposes a single `writeAuditLog(...)` helper called after every meaningful mutation. Company context (active company) is resolved server-side from real membership rows, not trusted from client state, even though the company switcher UI sets a client-side "selected company" for navigation convenience.

## Database Changes

**As implemented** (10 migrations actually applied, in this order — supersedes the originally proposed 9-file plan below the line, which underestimated the RLS helper-function sequencing dependency called out in this section's last paragraph):

1. `0001_organisations.sql` — `organisations` table + RLS (permissive read) + seed the single Orex Group row.
2. `0002_roles_permissions.sql` — `roles`, `permissions`, `role_permissions` tables + RLS + seed the full catalog and Phase 001 matrix. Moved before `companies`/`company_members` because later RLS helper functions join against these tables.
3. `0003_companies.sql` — `companies` table + a temporary permissive RLS policy (replaced in migration 6) + seed Orextic/Orex Studios.
4. `0004_user_profiles.sql` — `user_profiles` table + RLS + `handle_new_user()` trigger on `auth.users` insert.
5. `0005_organisation_members.sql` — `organisation_members` table + RLS (self-select only; no client insert/update policy — grants are service-role + application-code-checked only).
6. `0006_company_members_and_rls_helpers.sql` — `company_members` table + RLS, **and** the shared `SECURITY DEFINER` functions `has_company_permission()`/`has_org_permission()`/`is_company_member()`, **and** the replacement of `companies`' temporary policy with the real permission-aware one. Combined into one file because the helper functions require `company_members`/`organisation_members` to already exist, and `companies`' real policy requires the helper functions to already exist — this is the sequencing dependency the original plan flagged as an open risk.
7. `0007_invitations.sql` — `invitations` table + RLS.
8. `0008_audit_logs.sql` — `audit_logs` table + RLS (select only, gated by `audit.read`; no insert/update/delete policy for any client role — writes are service-role only via `lib/audit`).
9. `0009_harden_function_grants.sql` — revokes `anon` EXECUTE on the helper functions (defense-in-depth hardening surfaced by the Supabase security advisor; `authenticated` necessarily keeps EXECUTE since RLS policies invoke these functions as the querying role).
10. `0010_effective_permissions_function.sql` — `my_effective_permissions(company_id)`, used by `inviteMember` to enforce the "assignable role ≤ inviter's own permission set" rule (docs/permissions.md Invitation Permissions) — not anticipated in the original plan, added during implementation because enforcing that rule requires a set of permission keys, not just a boolean check.

<details>
<summary>Original pre-implementation proposal (superseded, kept for history)</summary>

1. `0001_organisations.sql` — `organisations` table + seed the single Orex Group row.
2. `0002_organisation_members.sql` — `organisation_members` table + RLS.
3. `0003_companies.sql` — `companies` table + RLS + seed Orextic/Orex Studios.
4. `0004_user_profiles.sql` — `user_profiles` table (+ trigger to create a row on `auth.users` insert) + RLS.
5. `0005_roles_permissions.sql` — `roles`, `permissions`, `role_permissions` tables + seed catalog and Phase 001 matrix.
6. `0006_company_members.sql` — `company_members` table + RLS + partial unique index (one active membership per company/user).
7. `0007_invitations.sql` — `invitations` table + RLS.
8. `0008_audit_logs.sql` — `audit_logs` table + RLS (insert-only via server, no client insert policy; read gated by `audit.read`).
9. `0009_permission_helper_functions.sql` — shared `SECURITY DEFINER` SQL function(s) implementing the permission-resolution rule, used by RLS policies across the tables above (per `docs/security.md` Row Level Security).

</details>

## Tables

See `docs/data-model.md` Phase 001 Tables section for full field-by-field detail: `organisations`, `organisation_members`, `companies`, `user_profiles`, `company_members`, `roles`, `permissions`, `role_permissions`, `invitations`, `audit_logs`.

## Relationships

See `docs/data-model.md` ER diagram.

## RLS Requirements

Every table above except `permissions`/`roles`/`role_permissions` (global catalogs, readable by any authenticated user, writable only via `permissions.manage`) is protected by a company- or organisation-scoped policy using the shared SQL helper function. `audit_logs` has no UPDATE/DELETE policy for any role. Full design workflow: `.agents/skills/orex-rls-security/SKILL.md`.

## Server Authorization

`lib/permissions.hasPermission(userId, companyId, permissionKey)` is the single sanctioned check, called at the top of every protected server action/route handler before validation and mutation. See `docs/permissions.md` Permission Evaluation Algorithm.

## Permission Requirements

Full catalog and Phase 001 role matrix: `docs/permissions.md`. Enforcement in Phase 001 covers `companies.*`, `team.*`, `permissions.*`, `audit.read`, `settings.manage`; remaining catalog keys are seeded but unenforced (no tables yet).

## Invitation Flow

Director/Founder with `team.invite` creates an invitation (company, role, email) → server generates a random token, stores only its hash, sets `expires_at` (recommend 7 days, confirm with founder) → invitee receives a link (delivery mechanism — email — is an open question below) → invitee visits accept page, server validates token hash + not expired + not already accepted → on accept, creates/activates a `company_members` row and marks the invitation `accepted`. Role assignable at creation is capped to the inviter's own effective permission set (see `docs/permissions.md`).

## Company Switcher

Client component listing companies the current user has active `company_members` rows in, plus, for organisation-level grant holders, an "all companies" or per-company view sourced from `organisation_members`. Selecting a company sets client-side navigation context; every subsequent server call still independently re-derives real access — the switcher's selection is UX only, not an authorization input.

## Founder Group Access

Modeled as an `organisation_members` row with the Founder role, granted/revoked only via `permissions.manage` (founder-only in Phase 001, since no second founder-equivalent role exists yet — first-grant bootstrapping is an open question below). Resolved through the same `hasPermission` function as any company-level check — see `docs/permissions.md` Founder Access.

## Audit Logging

`lib/audit.writeAuditLog({...})` called after every mutation to: `company_members` (create/role-change/remove), `organisation_members` (grant/role-change/remove), `invitations` (create/accept/revoke/expire), `companies` (create/update/archive), `role_permissions` (add/remove). Fields per `docs/data-model.md` `audit_logs` entity. See `.agents/skills/orex-audit-system/SKILL.md`.

## UI Components

Per `docs/design-system.md` Phase 001 Components Needed: sign-in form, minimal authenticated shell, company switcher, company member list + invite form + remove-member confirmation, invitation-acceptance page, audit log view (data table), optional read-only permission matrix view.

**As implemented:** member removal uses a native browser `window.confirm()` dialog inline in `components/team/MemberTable.tsx`, not a dedicated `RemoveMemberModal` component as originally planned below — a scope simplification made during implementation (the confirmation requirement is met; the custom-modal *component* was not built). No optional permission matrix view was built either. If a custom modal becomes worth the investment later (e.g., to show a richer warning, or once the design system's modal pattern is otherwise in use elsewhere), it should replace this inline dialog rather than living alongside it.

## Files Expected to Change

- `package.json` (add `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `resend`, `vitest`)
- `.env.example` (add `RESEND_API_KEY`)
- `app/layout.tsx` (replace scaffold branding/title with Orex OS shell; keep Geist fonts)
- `app/page.tsx` (replace scaffold marketing page with real landing/redirect logic — e.g., redirect to sign-in or Today placeholder)
- `app/globals.css` (extend `@theme inline` with accent + surface tokens per `docs/design-system.md`)
- `middleware.ts` (new — session refresh/validation)

## Files Expected to Be Created

**As implemented** (supersedes the flat-route assumptions below, which didn't yet account for company-scoped routing being needed for a working company switcher):

- `supabase/migrations/0001_*.sql` … `0010_*.sql` (see Database Changes — 10 files, not 9)
- `lib/database/server.ts`, `lib/database/browser.ts`, `lib/database/companies.ts` (Supabase clients + a company-by-slug lookup)
- `lib/auth/session.ts`, `lib/auth/invitation-token.ts` (resolve current user server-side; generate/hash invitation tokens)
- `lib/permissions/catalog.ts`, `lib/permissions/index.ts`, `lib/permissions/role-cap.ts` (`hasPermission`, catalog constants, invitation role-cap logic)
- `lib/audit/index.ts` (`writeAuditLog`, with secret-key redaction)
- `lib/validation/auth.ts`, `lib/validation/invitations.ts`, `lib/validation/members.ts` (Zod schemas)
- `lib/integrations/email.ts` (Resend client + invitation email template)
- `vitest.config.ts`
- `app/(auth)/layout.tsx`, `app/(auth)/sign-in/page.tsx`, `app/(auth)/accept-invite/[token]/page.tsx`
- `app/(app)/layout.tsx` (authenticated shell)
- `app/(app)/[companySlug]/layout.tsx`, `app/(app)/[companySlug]/page.tsx` (resolves company by slug; redirects to `/team`)
- `app/(app)/[companySlug]/team/page.tsx` (member list + invite + remove) — company-scoped route, not the flat `/team` originally planned
- `app/(app)/[companySlug]/audit/page.tsx` (audit log view) — company-scoped route, not the flat `/audit` originally planned
- `app/actions/team.ts` (`inviteMember`, `acceptInvitation`, `revokeInvitation`, `removeMember`, `updateMemberRole`, `listMyCompanies`, `currentUserCan`)
- `app/actions/organisation.ts` (`grantOrganisationAccess`, `revokeOrganisationAccess`, `listAuditLog`)
- `app/actions/auth.ts` (`signInWithPassword`, `signUpWithPassword`, `signInWithMagicLink`, `signOut`)
- `components/company/CompanySwitcher.tsx`
- `components/team/MemberTable.tsx` (removal confirmation is an inline `window.confirm()`, not a separate modal component — see UI Components), `components/team/InviteForm.tsx`
- `components/audit/AuditLogTable.tsx`
- `components/auth/SignInForm.tsx` (password / magic link / sign-up), `components/auth/SignOutButton.tsx`, `components/auth/AcceptInviteClient.tsx`
- `lib/permissions/role-cap.test.ts`, `lib/auth/invitation-token.test.ts`, `lib/validation/invitations.test.ts` — colocated `*.test.ts` files, not a separate `__tests__/` directory

## Validation

Zod schemas for: invitation creation (email, companyId, roleId), invitation acceptance (token), member role change, member removal reason (optional), company create/update. All server actions reject invalid input before any database call.

## Security Requirements

Full detail: `docs/security.md`. Phase 001 must satisfy: RLS on every table, server-side permission check on every mutation, no service-role key in browser code, invitation tokens hashed + expiring + single-use, role assignment capped at invitation time, removed members lose access immediately, audit log append-only.

## Migration Safety

All Phase 001 migrations are additive (creating new tables) — no existing schema to break. Migrations must be applied in dependency order (see Database Changes). No migration in this phase alters or drops anything.

## Existing Features That Must Be Preserved

None at the product-feature level (nothing exists). Preserve the working toolchain: Next.js/TypeScript/Tailwind v4/ESLint config, the `@/*` path alias, and the `.claude/commands/` + `.agents/skills/` workflow scaffolding.

## Acceptance Criteria

- [ ] `organisations`, `organisation_members`, `companies`, `user_profiles`, `company_members`, `roles`, `permissions`, `role_permissions`, `invitations`, `audit_logs` exist via applied migrations
- [ ] Orex Group, Orextic, and Orex Studios are seeded
- [ ] Full Phase 001 permission catalog and role matrix are seeded per `docs/permissions.md`
- [ ] A user can sign in via Supabase Auth
- [ ] `hasPermission()` correctly resolves company-level and organisation-level grants
- [ ] RLS policies exist on every company/organisation-scoped table and independently enforce the same boundary as the server check
- [ ] Founder (via `organisation_members`) can see all companies in Orex Group
- [ ] An Orextic-only user cannot read or write Orex Studios data (server or direct query)
- [ ] An Orex Studios-only user cannot read or write Orextic data
- [ ] A Viewer cannot create/update/delete anything
- [ ] A Contractor cannot access finance-permission-gated actions (catalog-level check, since no finance tables exist)
- [ ] Removing a member immediately revokes their access
- [ ] An expired invitation cannot be accepted
- [ ] A forged/tampered `company_id` in a request cannot bypass company isolation
- [ ] Every listed mutation writes a correct audit record (actor, company, action, before/after where applicable)
- [ ] No service-role credential appears in the built browser bundle
- [ ] Company switcher shows only authorized companies and does not itself grant access (removing the client selection cannot expand server-side access)

## Automated Tests

Unit tests for `hasPermission()` (every role × representative permission combination from the matrix), Zod validation schemas (valid/invalid input), and the invitation-role-cap logic. Integration tests for `inviteMember`, `acceptInvitation`, `removeMember` server actions against a real (test) Supabase instance.

## RLS Tests

For each Phase 001 table: active member can read/write within policy; inactive/removed member cannot; user from another company cannot; forged `company_id` query returns no rows; organisation-level grant holder can read across companies in their organisation.

## Permission Tests

Founder: full matrix access. Director: company-scoped subset. Contractor: minimal set, no finance/team-mutation/secrets. Viewer: read-only, zero mutation permissions. Verify each against the seeded matrix in `docs/permissions.md`.

## Manual Tests

Founder can see authorised group companies.
Orextic-only user cannot access Orex Studios.
Orex Studios-only user cannot access Orextic.
Viewer cannot mutate.
Contractor cannot access finance unless explicitly authorised.
Removed user loses access.
Expired invite cannot register.
Forged company id cannot bypass company isolation.
Audit records identify actor and action.

## Regression Tests

Not applicable in the traditional sense (no prior features exist to regress). Confirm the default Next.js build still compiles and the toolchain (lint, type check, build) remains green after every implementation slice.

## Rollback Plan

Each migration is a discrete, additive file; rollback = a corresponding down-migration or, pre-production, simply resetting the local/dev Supabase database and re-running migrations from zero. No production data exists yet, so rollback risk is minimal for this phase specifically.

## Risks

1. Founder-grant bootstrapping: the first `organisation_members` Founder row must be created by some initial, out-of-band step (seed migration with the founder's known user id, or a one-time manual grant) since `permissions.manage` is required to grant it and no one holds it yet at t=0 — see Open Questions.
2. If RLS helper functions and server-side `hasPermission` drift in logic over time, the two layers could disagree — mitigated by sharing the same rule definition (see `docs/permissions.md`), but requires discipline in future phases to keep them in sync.
3. Invitation delivery mechanism (email) is not yet decided — Phase 001 can implement the accept-invite flow and token logic without a real email provider (e.g., surface the invite link directly to the inviter to share manually) if email integration is deferred.

## Open Questions — RESOLVED

1. **Founder bootstrap**: one-time manual grant after first sign-in. The founder signs in first via Supabase Auth, then a documented one-off admin SQL statement (not automated in a migration) grants the initial Founder `organisation_members` row.
2. **Supabase project**: provision now. A new dedicated project, `orex-os`, region `ap-southeast-1`, is created for Orex OS (isolated from the founder's existing "mrachiya1's Project").
3. **Sign-in method**: both email+password and magic link.
4. **Invitation delivery**: both — manual link sharing (always available, no dependency) and real email send via **Resend**. Requires a `RESEND_API_KEY` (server-only env var, added to `.env.example`) — founder to provide the actual key at implementation/deployment time; never committed.
5. **Invitation expiry window**: 7 days.
6. **Test runner**: Vitest, added as a new devDependency.

## Implementation Instructions

Do not implement until the founder explicitly approves this prompt (status above must move from PROPOSED/NOT APPROVED to APPROVED, and the Open Questions above should be answered or explicitly deferred). Do not expand scope during implementation — if something in Out of Scope appears necessary, stop and report rather than building it. Do not implement Phase 002 (OpenRouter Gateway) or any later phase.

---

**Summary for approval**: This phase builds the org/company/membership/role/permission/invitation/audit foundation described above — 10 tables across 10 migrations, Supabase Auth wiring, server-side + RLS permission enforcement, and a minimal UI (sign-in, company switcher, team management, audit log) to exercise it. No AI, no operational modules, no redesign. Six open questions above need answers (or explicit "defer/use your judgment") before implementation starts, most importantly #1 (founder bootstrapping) and #2 (live Supabase project timing).

Then stop.

---

## Closure

**Status: CLOSED (2026-09-05).** Implemented, tested, security-reviewed, and manually verified in the browser (sign-in, company switcher, Orextic and Orex Studios team pages, invitation creation and acceptance with a separate test user, audit log page, company isolation, role restrictions, removed-member access revocation). Two real bugs found during manual verification (invitation acceptance not checking the accepting user's email against the invitation's target email; a `upsert(onConflict:...)` call that couldn't target a partial unique index) were fixed and re-verified before closure. See `docs/current-state-audit.md` and this file's "As implemented" notes above for the authoritative record of what was actually built versus originally planned.
