# Orex OS Security Architecture

## Security Principles

Defense in depth (server check + RLS, never either alone); default deny; least privilege; every mutation traceable; secrets isolated from ordinary data paths; no reliance on the frontend for any security property.

## Threat Model

Primary threats for Phase 001: (1) a user from one company reading or writing another company's data, including via a forged/tampered company id in a request; (2) a lower-privilege user (Viewer/Contractor) mutating data they should only read or shouldn't see at all; (3) a removed user retaining access after removal; (4) an invitation being reused after expiry or accepted at an escalated role; (5) service-role/Supabase credentials leaking into the browser bundle or logs; (6) an authorization check existing in only one of {server, database} and drifting out of sync with the other. Future phases add AI-specific threats (prompt injection, unapproved AI mutations, secret exposure to AI context) — out of scope for Phase 001's actual attack surface since no AI exists yet, but the model here is designed not to need rework when AI arrives.

## Authentication

Supabase Auth (email/password and/or magic link — exact method confirmed at implementation time) issues sessions. No custom auth system is built. Next.js middleware validates/refreshes the session on every request using Supabase's SSR cookie helpers.

## Session Security

Sessions live in secure, httpOnly cookies (never `localStorage`/`sessionStorage`, which are readable by any script and thus XSS-exposed). Session refresh happens server-side in middleware. No session token is ever passed through a URL query string or logged.

## Authorization

See `docs/permissions.md` in full. Summary: server-side `hasPermission()` check on every handler, backed by RLS policies that encode the identical rule, so a bug in one layer alone does not grant access.

## Multi-Company Isolation

Every company-scoped table carries `company_id`. Access requires an active `company_members` row for that company (or an active `organisation_members` grant covering that company's organisation). A request's claimed `company_id` (from a URL param, form field, or client state) is never trusted directly — the server re-derives the caller's actual permitted companies from their session and membership rows before touching data, and RLS enforces the same boundary independently at the query layer.

## Row Level Security

RLS is enabled on every table holding company-scoped or sensitive data, default deny (no policy = no access). Policies use a shared `SECURITY DEFINER` SQL helper (mirroring `hasPermission`) rather than each table reinventing the membership/role join. See `.agents/skills/orex-rls-security/SKILL.md` for the design workflow.

## Server-Side Validation

Every server action/route re-validates authentication, membership, permission, and input shape — never assumes a prior client-side check was honest.

## Input Validation

Zod schemas validate every server action/route input before it touches the database. Validation failures return safe, generic error messages (no schema internals leaked to an unauthenticated caller beyond what's necessary for a legitimate client to fix its own request).

## Output Validation

Server responses are shaped explicitly (never `SELECT *` passed straight to the client) so that a future column addition to a sensitive table doesn't silently leak into an API response.

## CSRF / Request Protection

Next.js Server Actions include built-in CSRF protection (origin checking on POST). Route handlers that accept mutations from the browser must also verify same-origin where Server Actions' built-in protection doesn't apply.

## Invitation Security

Invitation tokens are generated with a cryptographically random value; only a hash (`token_hash`) is stored, never the raw token. Tokens are single-use (status flips to `accepted` atomically). Expired invitations (`expires_at` passed) are rejected at acceptance time regardless of token validity. An invitation can only assign a role at or below the inviter's own effective permission set (see `docs/permissions.md` Invitation Permissions) — enforced server-side at creation time, not just hidden in the UI.

## Role Escalation Protection

No user-facing path allows a user to grant themselves or another user a role/permission set broader than their own. `permissions.manage` (editing `role_permissions`) and granting `organisation_members` rows are founder-only actions. Invitation role assignment is capped as above.

## Founder Account Security

The founder's elevated access is modeled as an explicit, auditable, revocable `organisation_members` grant (see `docs/data-model.md`, `docs/permissions.md`) — not a hardcoded `role === 'founder'` bypass anywhere in code. This means the founder account is a normal account from the authorization engine's point of view, just one with a wide (but visible, auditable, revocable) grant.

## MFA Strategy

Not implemented in Phase 001. Supabase Auth supports MFA (TOTP); recommended for the founder account in a later phase given the breadth of `organisation_members` access. Flagged as an open question below.

## Secrets Management

Passwords, API keys, access tokens, and integration secrets never enter `user_profiles`, `company_members`, `invitations`, or any other Phase 001 table, and never enter `audit_logs.before_state`/`after_state`/`request_metadata` (the audit helper must redact known secret-shaped fields before writing, and callers must not pass secret values into audit calls in the first place). A dedicated secrets vault is an explicit future feature (AGENTS.md §14), not built in Phase 001.

## Environment Variables

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe for the browser (by Supabase design — the anon key is meant to be public and relies on RLS for safety). `SUPABASE_SERVICE_ROLE_KEY` is server-only, never referenced from a `"use client"` file or any code that ships to the browser bundle. `OPENROUTER_API_KEY`, `POSTHOG_KEY` (server variant), and `APP_URL` follow the same server-only rule where applicable. `.env.example` documents all variable names with blank values; real values live only in untracked `.env.local` / deployment platform secrets.

## Database Security

RLS enabled on all sensitive/company-scoped tables; no table is created without a paired policy decision recorded in its migration. Foreign key constraints enforce referential integrity across the org/company/membership/role/permission graph. The service-role key, when used server-side for operations that must intentionally bypass RLS (rare — e.g., an admin action working across companies), still re-implements the equivalent permission check in application code first; it is never used as a shortcut around checking permissions.

## Storage Security

Not applicable — no file storage implemented in Phase 001.

## File Upload Security

Not applicable — no file upload implemented in Phase 001.

## Finance Data Security

Not applicable in Phase 001 (no finance tables exist), but the permission catalog and matrix already reserve `finance.*`/`transactions.*` as Restricted-sensitivity, approval-gated permissions for when that module ships.

## Client Data Security

Not applicable in Phase 001 (no clients table exists). Reserved similarly.

## Team Privacy

`company_members` and `user_profiles` are visible only to users sharing a company (via `team.read`) or with organisation-level access — not globally readable across all companies.

## Audit Logs

Append-only (`audit_logs` has no UPDATE/DELETE RLS policy and no application code path to modify or delete a row). Readable only by users holding `audit.read` for the relevant company, or organisation-level grant holders. See `.agents/skills/orex-audit-system/SKILL.md`.

## Logging Policy

Application/server logs (console output, any future structured logging) must never include secret values, raw invitation tokens, or full session tokens. Audit log `error_details` fields are redacted before write for the same reason.

## AI Security

Not applicable in Phase 001 — no AI integration exists. Principles carried forward for future phases: AI runs server-side only, never executes arbitrary SQL, only calls allowlisted permission-checked functions, and every AI mutation is audited and approval-gated per AGENTS.md §10.

## AI Context Redaction

Not applicable in Phase 001. Reserved principle: before any data reaches an AI provider, secrets/tokens/payment data/unnecessary PII are stripped (AGENTS.md §15).

## Prompt Injection Risk

Not applicable in Phase 001 (no AI). Flagged as a Phase 002+ concern to design against when the Advisor/AI Gateway is built.

## AI Tool Security

Not applicable in Phase 001. Reserved: AI tools are allowlisted server functions with their own permission checks, never raw database access.

## External Integration Security

Not applicable in Phase 001 — no integrations exist.

## Rate Limiting

Not implemented in Phase 001. Recommended before any public-facing auth endpoint (sign-in, invitation acceptance) goes to production, to blunt credential-stuffing/token-guessing attempts — flagged as an open risk below rather than blocking Phase 001 development.

## Abuse Prevention

Invitation tokens are high-entropy and single-use; sign-in relies on Supabase Auth's built-in protections. No additional abuse-prevention tooling in Phase 001.

## Account Revocation

Removing a `company_members` (or `organisation_members`) row immediately removes access on the next request — both the server-side check and RLS re-evaluate `status = 'active'` on every call rather than caching a stale permission set for the session lifetime.

## Backup Strategy

Relies on Supabase's managed Postgres backups once a project is provisioned. No custom tooling in Phase 001.

## Recovery Strategy

Standard Supabase point-in-time recovery. No custom tooling in Phase 001.

## Data Export

Not implemented in Phase 001.

## Data Deletion

Phase 001 uses soft-delete/status patterns throughout (`companies.status`, `company_members.status`, `organisation_members.status`) rather than hard deletes, preserving audit and referential history. No hard-delete/GDPR-erasure flow is implemented in Phase 001 — flagged as a future requirement if Orex OS ever handles data subject to erasure obligations.

## Development Environment Security

`.env.local` (real values) is git-ignored. No real Supabase/OpenRouter keys are ever committed, documented with real values, or placed in prompts, docs, or seed files — `supabase/seed.sql` must only ever contain non-secret sample/reference data.

## Production Environment Security

Deployment target not yet decided (see `docs/current-state-audit.md`); whichever platform is chosen, secrets are configured as platform environment variables, never committed.

## Security Testing

Manual tests required at minimum (see also `.agents/skills/orex-test-security/SKILL.md`):

1. Orextic user cannot access Orex Studios data.
2. Orex Studios user cannot access Orextic data.
3. Contractor cannot access finance-permission-gated actions.
4. Viewer cannot mutate records (create/update/delete all denied).
5. A forged/tampered company id in a request does not bypass authorization (server re-derives real membership; RLS independently blocks it even if the server check were somehow skipped).
6. AI cannot reveal secrets — not applicable yet (no AI, no secrets vault), tracked as a future test.
7. AI cannot perform unapproved finance mutations — not applicable yet, tracked as a future test.
8. Removed user immediately loses access on next request.
9. Expired invitation cannot be used to register.
10. Service-role credentials do not appear in the browser bundle (verified by inspecting the built client JS, not just source).

## Phase 001 Security Requirements

Auth (Supabase), server-side `hasPermission()` helper, RLS on every Phase 001 table, audit logging for every mutation listed in `docs/data-model.md`, invitation token hashing/expiry, no service-role key in browser code, `.env.example` kept current with no real values.

## Known Risks

1. No MFA on the founder account in Phase 001, despite it holding the widest possible grant — recommend as a near-term follow-up, not a Phase 001 blocker.
2. No rate limiting on auth/invitation-acceptance endpoints in Phase 001 — recommend before any production/public exposure.
3. Service-role key usage (where genuinely needed) depends on developer discipline to re-check permissions in code; recommend a lint/review checklist item (already reflected in `.agents/skills/orex-rls-security/SKILL.md`) rather than assuming this can be fully automated in Phase 001.

## Open Security Questions

1. Confirm the exact Supabase Auth sign-in method (password vs magic link vs both) before implementation.
2. Confirm whether MFA should be required for the founder account starting in Phase 001 or deferred.
