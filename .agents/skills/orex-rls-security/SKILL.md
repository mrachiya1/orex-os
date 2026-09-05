# Orex RLS Security

## Purpose

Reusable procedure for writing and reviewing Row Level Security policies on any new Orex OS table. Full architecture lives in `docs/security.md` and `docs/permissions.md`; this skill is the actionable checklist applied every time a migration adds or changes a table that holds company- or group-scoped data.

## Core Principle

Frontend filtering is not security. Every company-scoped table must deny access by default and grant it back only through an explicit policy that re-derives the same authorization decision the server-side permission check already makes — RLS is the backstop that holds even if application code has a bug, not a redundant formality.

## Default Deny

`alter table <t> enable row level security;` on every new table, immediately after creation, before any policy is added. A table with RLS enabled and zero policies denies all access to the `authenticated`/`anon` roles by default — this is the correct starting state, never a bug to "fix" by adding an overly broad policy.

## Company Membership Pattern

Use the existing `SECURITY DEFINER` helper functions — `has_company_permission(company_id, permission_key)`, `has_org_permission(organisation_id, permission_key)`, `is_company_member(company_id)` (defined once, in `0006_company_members_and_rls_helpers.sql`) — never write a new inline membership-resolution subquery in a policy. Adding a table never requires a new helper function; it requires calling the existing ones with the right permission key.

## Group-Scoped (nullable company_id) Pattern

For a table where `company_id` can be null (meaning "Orex Group level," e.g. `knowledge_items`), the policy must branch:
```sql
using (
  (company_id is not null and has_company_permission(company_id, 'X'))
  or (company_id is null and has_org_permission(organisation_id, 'X'))
)
```
Never grant access to a null-`company_id` row through a company-level permission alone — group-level data always requires the organisation-level check.

## SELECT / INSERT / UPDATE / DELETE Policies

Write the narrowest policy that matches the actual required action: a table with no legitimate client-facing DELETE (e.g. `audit_logs`, `ai_usage_events`, and by design `knowledge_items`/`decisions` — archiving is an UPDATE, never a DELETE) simply has no DELETE policy at all, which denies it entirely rather than trying to write a DELETE policy that always evaluates false. INSERT policies check the create-permission key; UPDATE policies check the update-permission key in both `using` and `with check` (so a caller can't read a row it's allowed to update, then use that same policy to write completely different data it wouldn't otherwise be allowed to write).

## WITH CHECK

Always mirror the `using` clause in `with check` for UPDATE/INSERT policies unless there's a specific reason they should differ (Phase 001's `company_members_update` policy is the documented exception: it accepts either `team.update` or `team.remove` in both clauses because a single UPDATE statement can't distinguish "changing a role" from "marking removed" at the RLS layer — that distinction is enforced in the server action instead, RLS is only the floor).

## Policy Helper Functions

Never invent a bespoke SQL helper per table unless the authorization shape genuinely can't be expressed with `has_company_permission`/`has_org_permission`. Every Phase 003 table (`knowledge_sources`, `knowledge_items`, `knowledge_chunks`, `decisions`, `decision_reviews`) reuses these same two functions — no new SQL function was needed for Phase 003.

## Indirect Tables (chunks, reviews)

A table with no direct company/organisation column of its own (`knowledge_chunks` keyed to `knowledge_items`; `decision_reviews` keyed to `decisions`) still needs its own RLS policy, not just reliance on the parent's policy — a direct query against the child table must independently re-derive the same scoping by joining back to the parent (`exists (select 1 from knowledge_items ki where ki.id = knowledge_chunks.knowledge_item_id and (... same branch as above ...))`). Never assume "no one queries this table directly" is a safe substitute for a real policy.

## Founder / Group Access

Founder access is never a `role = 'founder'` bypass anywhere in a policy — it flows through the exact same `has_org_permission` check as any other organisation-level grant holder. If a policy has a special case for "founder," it is a bug — the correct policy has no awareness that a founder exists, only that an active `organisation_members` grant with the right permission does.

## Common RLS Mistakes

Writing a policy using a client-supplied value instead of `auth.uid()`/the helper functions. Granting a broad `using (true)` "temporarily" and forgetting to narrow it (Phase 001's `companies_select_temp_authenticated` was intentionally short-lived and replaced in the very next migration — never leave a temporary permissive policy past the migration that's supposed to replace it). Omitting a policy on a child table because the parent "already" restricts access. Forgetting `with check` on an UPDATE policy, allowing a caller to use a legitimate read-scope to write out-of-scope data.

## Review Checklist (run this after any new/changed table)

1. Is RLS enabled on the table?
2. Does every policy use `has_company_permission`/`has_org_permission`/`is_company_member`, never a bespoke inline check?
3. Does a nullable-`company_id` table correctly branch to the org-level check for null rows?
4. Does every child/indirect table have its own policy joining back to its parent's scoping, not just an assumption that the parent protects it?
5. Do UPDATE/INSERT policies have matching `using`/`with check` (or a documented, deliberate reason they differ)?
6. Is there any table-wide `using (true)` policy left over from a "temporary" state?
7. Manual test: Orextic-only user cannot read/write an Orex Studios row; a forged/guessed id in a query returns zero rows, not an error that leaks existence; a removed member's next request is denied; a founder's org-level grant, and only that grant, reaches group-level rows; a Viewer-equivalent role cannot mutate anything gated behind a create/update/verify permission.
