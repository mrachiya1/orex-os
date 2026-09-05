# Orex Audit System

## Purpose

Reusable procedure for deciding what to audit and how to write an audit record correctly. Full schema and rationale live in `docs/data-model.md` (`audit_logs`) and `docs/security.md`; this skill is the actionable checklist for any code that mutates protected data.

## When to Use This Skill

Any server action or server-side code path that creates, updates, archives, verifies, removes, or otherwise changes a protected record — company/team/permission mutations (Phase 001), AI-mutation features (future, per `orex-safe-ai-actions`), and knowledge/decision mutations (Phase 003: `knowledge.*`, `decision.*` events).

## Core Principle

`audit_logs` records that a change happened and who/what caused it. It is never the store of the actual business data — never write the full content of a knowledge item, a document, or a decision's substance into `before_state`/`after_state` beyond what's needed to reconstruct the change; the real record lives in its own table.

## What Must Be Audited

Every mutation to: `company_members`, `organisation_members`, `role_permissions` (Phase 001); `knowledge_items`, `decisions`, `decision_reviews` (Phase 003); any future protected table. Reads are never audited (too high volume, no state changed) — only the mutations that change what a future read or permission check would return.

## Required Fields

`actor_user_id`, `actor_type` (`human` | `ai_agent` | `system` | `automation`), `organisation_id`, `company_id`, `resource_type`, `resource_id`, `action` (a stable `resource.verb` string, e.g. `knowledge.verified`), `before_state`, `after_state`, `reason`, `approval_status`, `approval_user_id`, `ai_session_id`, `ai_agent_id`, `request_metadata`, `result_status` (`success` | `failure`), `error_details`, `created_at` (defaulted by the database, never supplied by the caller).

## How to Write an Audit Record

Always through `lib/audit/index.ts`'s `writeAuditLog(event)` — never a direct `insert` into `audit_logs` from feature code. It uses the service-role client (the table has no client-facing INSERT policy) and redacts `before_state`/`after_state`/`request_metadata`/`error_details` through `lib/audit/redaction.ts`'s `redactSecrets()` before writing, unconditionally, regardless of whether the caller thinks the payload is safe.

## Secret Access Audits

Never log the revealed secret itself, even in `after_state` or `error_details` — `redactSecrets()` strips any key matching the secret-pattern regex as a backstop, but the calling code should never have put a secret value into the event payload to begin with. No secrets vault exists yet (AGENTS.md §14); when it ships, a "secret revealed" audit event records that a reveal happened (actor, secret id, reason), never the value.

## AI-Originated Mutations

An AI-triggered write (e.g., a future knowledge-extraction path that writes candidate rows) uses `actor_type: "ai_agent"` plus `ai_session_id`/`ai_agent_id` where applicable, but still carries `actor_user_id` set to the human who initiated the action (e.g., the person who pasted the text) — an AI-assisted human action is not the same as a fully autonomous one, and the audit trail should make clear a human was in the loop even when a model produced the content.

## Failure-Path Audits

A permission denial that a feature explicitly checks for (e.g., `lib/ai/gateway.ts`'s `ai.use` check) writes its own audit event with `result_status: "failure"` before throwing — the fact that someone attempted and was denied is itself worth recording. A generic unexpected error (a database timeout, a network failure) does not need its own audit event unless the mutation it was attempting is itself audit-worthy.

## Never

Use `audit_logs` as a substitute for the real business record. Allow any client-facing INSERT/UPDATE/DELETE policy on `audit_logs` — it must stay append-only via the service-role client only. Let a caller construct its own `actor_user_id` from client input — always resolve it server-side from the authenticated session. Skip writing an audit event because "the mutation already succeeded and returned" — the audit write happens alongside the mutation, not instead of it.

## Testing Checklist

A knowledge/decision mutation produces exactly one audit row with the correct `action` string. A denied permission check writes a `result_status: "failure"` audit row before throwing. `before_state`/`after_state` never contain a raw secret-pattern key's value. An audit-write failure (e.g., a transient database error) never blocks the caller's already-completed mutation from returning — verified by mocking `writeAuditLog` to reject and confirming the calling server action still returns successfully.

## Common Mistakes

Writing the full content of a knowledge item into `after_state` instead of just the fields that changed. Forgetting to audit a `verification_status` transition because "it's just a status flip." Constructing `actor_user_id` from a request parameter instead of `requireCurrentUser()`. Adding a client-facing write policy to `audit_logs` "just for this one feature."

## Regression Checklist

Re-run the full Phase 001 audit test coverage (organisation/company/permission mutations) after any change to `lib/audit/index.ts` or `lib/audit/redaction.ts` — every existing `writeAuditLog` call site must continue to produce identical redaction behavior.
