# 012 — Team: See All Invited People

## Files inspected

- `app/actions/team.ts` (full file) — `inviteMember`, `previewInvitation`, `acceptInvitation`, `revokeInvitation`
  (already exists, line ~283), `removeMember`, `updateMemberRole`, `updateMemberPermissionOverrides`,
  `listMyCompanies` (the list-action convention to follow).
- `supabase/migrations/0007_invitations.sql` — `invitations` table shape and RLS
  (`invitations_select` requires `team.read`; insert/revoke require `team.invite`).
- `supabase/migrations/0031_member_permission_overrides.sql` — confirmed `invitations.permission_overrides`
  column exists (added here, not in the original 0007 migration).
- `app/(app)/[companySlug]/team/page.tsx` — currently renders **only** the active-members table
  (`MemberTable`) plus an `InviteMemberButton`. There is no pending-invitations UI at all today.
- `app/(app)/[companySlug]/team/roles/page.tsx` — reference for the `Card`/`CardHeader` composition pattern.
- `components/team/MemberTable.tsx` (full file) — the direct template: `ox-table` class, `ox-pill ox-pill-neutral`
  badges, `useTransition` + `router.refresh()` after a mutation, `window.confirm` before a destructive action.
- `components/team/InviteMemberButton.tsx`, `InviteForm.tsx` — `Modal`/`Button` pattern for the existing invite flow.
- `lib/permissions/catalog.ts` — `TEAM_READ`, `TEAM_INVITE` confirmed present and already used for exactly this
  purpose (viewing / inviting-and-revoking).

## What exists that must be preserved

`inviteMember`, `previewInvitation`, `acceptInvitation`, and `revokeInvitation` are unchanged. The active-members
`MemberTable` and its layout on the Team page are unchanged — this feature adds a second list below/beside it,
it does not replace or restyle anything existing.

## Decisions

1. **No schema change** — the `invitations` table already has everything needed (`email`, `status`, `expires_at`,
   `created_at`, `invited_by`, joined `role_id` → `roles.label`).
2. **New server action**: `listInvitations(companyId): Promise<InvitationRow[]>` in `app/actions/team.ts`,
   following the exact `listMyCompanies` convention (no `ActionResult` wrapper, no pagination — matches every
   other `list*` action in this file) — `requirePermission(companyId, PERMISSIONS.TEAM_READ)` then a plain
   `.select("id, email, status, expires_at, created_at, invited_by, roles(label)")` ordered newest-first. Returns
   **all** invitations regardless of status (pending/accepted/revoked/expired) — the founder asked to "see all
   already invited people," which includes the full history, not just still-pending ones; the UI distinguishes
   status with a badge rather than the query hiding anything.
3. **New component**: `components/team/InvitationsTable.tsx` — mirrors `MemberTable.tsx`'s structure (`ox-table`,
   `EmptyState` for zero rows). Columns: Email, Role, Status (badge), Invited, Expires. A "Revoke" action appears
   only on rows with `status = 'pending'`, calling the existing `revokeInvitation` action — no new mutation logic.
4. **New status-badge component**: `components/team/InvitationStatusBadge.tsx` — small presentational component
   mapping `pending`/`accepted`/`revoked`/`expired` to distinct pill styles (extends the existing `ox-pill`
   classes rather than inventing a new visual language).
5. **Placement**: a second `Card`/`CardHeader` block ("Invitations") added to `team/page.tsx`, below the existing
   Members card — same page, no new route, matching how `roles/page.tsx` composes its single `Card`.
6. **Permissions**: `TEAM_READ` to view the table (identical to what already gates `MemberTable`), `TEAM_INVITE`
   to see/use the Revoke button (identical to what already gates `InviteMemberButton`) — no new permission
   catalog entries.

## Architecture

- `app/actions/team.ts` — add `listInvitations(companyId: string)` next to `listMyCompanies`.
- `components/team/InvitationsTable.tsx` (new) — client component, receives the already-fetched rows as a prop
  from the server component `team/page.tsx` (same data-flow pattern `MemberTable` uses today), calls
  `revokeInvitation` via `useTransition` + `router.refresh()` on click, `window.confirm` before revoking.
- `components/team/InvitationStatusBadge.tsx` (new) — pure presentational, no data fetching.
- `app/(app)/[companySlug]/team/page.tsx` — add a `listInvitations(company.id)` call alongside the existing
  members query, render the new `Card` beneath the Members card, gated on `hasPermission(..., TEAM_READ)`
  exactly like the rest of the page already gates its sections.

## Security implications

- Viewing invitations (including invited emails) requires `team.read`, matching the existing RLS policy exactly
  — no new data exposure beyond what the database already allows that permission to see.
- Revoking uses the existing `revokeInvitation` action and its existing `team.invite` check — unchanged.
- No token hashes, invite URLs, or secrets are ever included in the list — only `email`, `status`, role label,
  and timestamps (the same fields already selected/displayed elsewhere in this flow).

## Acceptance criteria

1. A user with `team.read` on a company sees an "Invitations" section on the Team page listing every invitation
   ever sent for that company (pending, accepted, revoked, expired), each with a status badge.
2. A user with `team.invite` sees a "Revoke" action on pending rows only; clicking it (after confirmation) revokes
   the invitation and the row's badge updates to "Revoked" without a full page reload feeling jarring
   (`router.refresh()` is sufficient, matching the existing member-removal UX).
3. A user without `team.read` sees no Invitations section at all (server-enforced, not just hidden).
4. No change to the invite-creation flow, the accept-invite flow, or the existing Members table.

## Tests

- `app/actions/team.test.ts` (new, or extend existing team-related tests if any exist) — `listInvitations`
  returns all statuses ordered newest-first; permission-denial path for a caller without `team.read`.
- Manual test steps (post-implementation):
  1. Send an invitation, confirm it appears in the new list as "Pending."
  2. Revoke it from the new list, confirm the badge updates to "Revoked" and the invite link stops working
     (already covered by existing `revokeInvitation`/`acceptInvitation` behavior — just confirming no regression).
  3. Let an invitation pass its `expires_at` (or manually backdate one in a test project) and confirm it displays
     as "Expired" without needing a revoke.
  4. As a contractor without `team.read`, confirm the Team page shows no Invitations section.

## Open questions before implementation

None — this is a small, fully-scoped addition with no schema change and no ambiguous product decision.
