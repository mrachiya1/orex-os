# People, Private Profiles, and Founder Group View

## Status

IMPLEMENTED, PARTIAL (2026-09-05). Reuses the entire Phase 001 identity model unchanged (one Supabase Auth identity, `company_members`/`organisation_members` for multi-company access, `roles`/`permissions`/`role_permissions`, `invitations`). This pass adds: work-profile fields, a genuinely private profile table with default-deny RLS, a connections architecture placeholder (no real OAuth), Member Profile pages, a read-only Roles & Permissions view, and a Founder Group View (`/group`). The multi-step registration wizard, real OAuth, field-level encryption, and MFA/sessions are explicitly deferred — see Remaining Gaps.

## Why multi-company membership needed no new schema

Inspected first: `acceptInvitation()` already scopes every check (`.eq("company_id", invitation.company_id).eq("user_id", user.id)`) per invitation, and creates or reactivates a `company_members` row for *that* company only. A second invitation to the same email for a different company, accepted while already signed in, simply adds a second `company_members` row — nothing about the flow assumes "one company per person." This was already correct; this pass only adds the UI (`CompanyAccessCard` → "+ Add Company Access" → `inviteMember` for a different company) to make that existing capability visible and usable.

## A real gap found and fixed: public self-registration

`/sign-in` rendered the full `SignInForm`, including its "Sign up" tab — meaning any visitor could create a Supabase Auth account with zero invitation, directly violating "Do NOT allow arbitrary public users to register." (The *access* side was already safe — a fresh sign-up gets zero `company_members` rows — but uncontrolled account creation itself wasn't.) Fixed: `SignInForm` now takes an `allowSignUp` prop; the public `/sign-in` page passes `false`. Sign-up remains available only from the accept-invite page, where it's contextually invitation-gated.

## Private profile: what's actually protecting it

`user_private_profiles` — one row per user, RLS `using (user_id = auth.uid())` on every policy, no exceptions, no organisation/company-permission branch anywhere. Verified live (impersonation, rolled back, zero leftover rows): the owner can read/write their own row; a second user (representing anyone else, Founder included — the policy makes no distinction) sees zero rows. **Protection used is RLS only, not field-level encryption.** Per AGENTS.md ("Do not claim data is encrypted simply because a table has RLS"), this is stated plainly rather than implied: adding real encryption needs an explicit decision on where keys live (Supabase Vault vs. an external KMS vs. app-managed) that wasn't part of this pass's approved scope — building it silently risked a worse outcome (a false sense of security) than deferring it with this note.

## Connections: architecture-ready, not functional

`user_connections` (provider/status/scopes/timestamps, owner-only RLS, verified live the same way) gives the Connections UI something real to read "Not connected" from. **No token column, no OAuth flow.** A real integration needs its own encrypted, server-only token store designed alongside that specific provider's flow — building a speculative token column now, with no encryption plan, would be exactly the kind of false security AGENTS.md warns against.

## Member Profile

`/[companySlug]/team/[userId]` — Work Profile (self-editable), Company Access (cross-company list, gated by organisation-level `team.read` so an Orextic-only admin can't discover someone's Orex Studios membership; falls back to showing just the current company's membership if the viewer lacks that org-level grant), Permissions (read-only matrix for the person's role in this company), and — only when `isSelf` — Private Profile and Connections. An admin viewing someone else's profile never sees those last two sections at all, not even as empty/disabled — they aren't rendered.

## Roles & Permissions

`/[companySlug]/team/roles` — read-only matrix per role, gated by `permissions.manage`. Editing role_permissions was not built: misconfiguring a role affects every member holding it company-wide, which is a materially different risk tier than viewing it, and wasn't asked for explicitly enough to build without a dedicated pass.

## Founder Group View

`/group` — its own shell (reuses `Sidebar`, anchored to the user's first visible company purely for nav links) gated by `hasOrgPermission(organisationId, 'projects.read')`. Every number is a real query filtered by `organisation_id` (not `company_id`); the existing `has_project_access`/`has_company_permission` organisation-level branches (already built in Phase 004) are what actually restrict the rows returned — no new RLS primitive, no frontend-only cross-company aggregation. Finance/Clients/Risks/Opportunities cards are not shown, per explicit instruction not to fabricate values for modules that don't exist.

## Files created

Migration `0030`. `lib/validation/people.ts`, `app/actions/people.ts`, `lib/database/permissions-catalog.ts`. `components/people/{WorkProfileCard,PrivateProfileCard,ConnectionsCard,CompanyAccessCard,PermissionsMatrix}.tsx`. `app/(app)/[companySlug]/team/[userId]/page.tsx`, `app/(app)/[companySlug]/team/roles/page.tsx`, `app/(app)/[companySlug]/settings/page.tsx`, `app/(app)/group/{layout,page}.tsx`.

## Files modified

`components/auth/SignInForm.tsx` + `app/(auth)/sign-in/page.tsx` (public sign-up removed), `components/team/MemberTable.tsx` + `app/(app)/[companySlug]/team/page.tsx` (link to member profile, Roles & Permissions link), `components/shell/Sidebar.tsx` + `app/(app)/[companySlug]/layout.tsx` (Group nav item, Settings now links somewhere real).

## Remaining Gaps

- **Multi-step registration wizard** (Welcome → Create Account → Work Profile → Privacy → Enter) — not built; the existing single-step accept-invite flow is unchanged. A "complete your work profile" nudge after first login was also not added.
- **Real OAuth connections** (Notion/Google) — UI placeholder only, as documented above.
- **Field-level encryption** for private-profile columns — not implemented; RLS is the only protection today, stated honestly rather than assumed.
- **MFA, active sessions list, password change UI, account recovery** — none built; flagged explicitly since the founder's brief calls for planning MFA enforcement before production use.
- **Role/permission editing UI** — read-only matrix only.
- **Contractor project-scope-at-invite-time** — invite flow is unchanged (company + role only); project assignment still happens after acceptance via the existing Project Team tab.
- **Search/Role/Status toolbar filters** on the Members table — not added.
- **Access Activity tab** on Member Profile (per-person audit log view) — not built.
