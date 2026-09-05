# Orex Test Security

## Purpose

Reusable checklist for what "tested" actually means on Orex OS before any phase is reported as ready to close. Never claim a test passed unless it was actually run and its real output was inspected — this skill exists so that claim is checkable, not just asserted.

## Test Categories

1. **Static checks**: `npm run typecheck`, `npm run lint` — must be run, not assumed, after any code change.
2. **Unit tests**: `npm run test` (Vitest) — every new module gets colocated `*.test.ts` coverage for its actual logic (permission gating, redaction, classification, state-transition rules), not just a smoke test that it imports.
3. **Integration tests**: real network calls where a mock would hide a real integration bug (e.g. `npm run test:integration` against live OpenRouter for chat and embeddings) — run explicitly, excluded from the default suite, skip themselves (not fail) when no key is configured.
4. **Production build**: `npm run build` — required whenever routes, server code, migrations, or dependencies change; a build can fail for reasons typecheck/lint don't catch (e.g. a Server/Client Component boundary violation).
5. **Database policy (RLS) tests**: live impersonation against the real Supabase project (or an equivalent RLS-aware harness) — a unit test that mocks the database client can never actually verify a Postgres RLS policy; this category requires hitting the real database.
6. **Manual tests**: a human (or an agent acting as one) actually clicking through the running application — required whenever a UI ships, per AGENTS.md §19.

## Required Multi-Company Tests

For any new company-scoped or group-scoped table: a user in Company A cannot read/write Company B's rows via any code path (UI, direct server action call, or a forged id); a founder's organisation-level grant, and only that grant, reaches group-level (`company_id is null`) rows; a company-level permission alone never exposes a group-level row.

## Required Permission Tests

For every new permission key: a role that should have it can perform the gated action; a role that shouldn't have it is rejected server-side even if it could somehow reach the client action (never trust that hiding a button is sufficient); a permission check and its corresponding RLS policy must agree — a manual cross-check that the two use the same permission key string.

## Required RLS Tests

Every new table: RLS enabled; a direct query using a non-privileged test identity returns zero rows for out-of-scope data, not an error; an indirect/child table (no direct `company_id` column) independently denies access when queried directly, not just through its parent.

## Required AI Tests

Unauthenticated request denied before any model call. Cross-company context denied (a `companyId` the caller isn't a member of never reaches `buildContext`/`retrieveKnowledge`). Secret-classified content never reaches embedding generation or a chat completion — verified by asserting the code path throws before any network call, not just by checking the response doesn't contain it. `ai.use` alone is insufficient where a feature also requires a data permission (e.g. `knowledge.read`) — test that holding only one of the two still fails.

## Automated Test Expectations

New logic gets a real unit test asserting the actual behavior (a permission-denial path, a state-transition rule, a redaction rule), not a placeholder that only checks the function doesn't throw on happy-path input. A schema validation (Zod) gets both a valid-input and an invalid-input case.

## Manual Test Expectations

Sign in as each relevant role and confirm what the UI shows/hides matches the permission matrix; attempt at least one action that should be denied and confirm the server rejects it (not just that the button is hidden); confirm empty/loading/error states render for at least one new view.

## Regression Checklist

Before reporting any phase as ready to close: the full previous-phase test suite(s) must be re-run and pass unmodified — not "should still pass" or "wasn't touched so probably fine." For Phase 003 and beyond: Phase 001 (org/company/permission/audit) and Phase 002 (AI gateway) suites both re-run in full, plus a live RLS spot-check on at least one previously-existing table to confirm no migration accidentally altered its policies.

## Common Mistakes

Reporting "tests pass" based on typecheck/lint alone without running the actual test suite. Treating a mocked unit test as sufficient evidence for an RLS policy (mocks cannot verify Postgres behavior). Skipping the live integration test because "the unit tests already mock the same shape" — a mock only proves the code calls the SDK correctly, not that the real API behaves as assumed. Declaring a security property true because "the code looks right" instead of actually attempting the denied action and observing the rejection.
