# Orex AI Context Policy

## Purpose

Reusable procedure for deciding what data is safe to hand an AI model. Full rationale lives in `docs/ai/context-policy.md` — this skill is the actionable checklist to follow every time you build or touch a context-assembly path.

## When to Use This Skill

Advisor, AI Agents, Company Brain retrieval, AI reports, meeting briefs, financial AI analysis, project intelligence, client intelligence, Builder Studio, or any other OpenRouter request. Any code that assembles data destined for a model prompt.

## Required Inputs

Before assembling context you must know: the current authenticated user, the resolved company scope (server-derived, never client-supplied), the requested task (which alias/feature), the minimum records that task actually needs, the caller's permissions, and the data classification of each candidate field.

## Context Construction Workflow

1. Identify the task.
2. Resolve current user (`lib/auth`).
3. Resolve company scope server-side — never trust a client-supplied company id.
4. Verify membership/organisation-level grant.
5. Verify permission (`lib/permissions.hasPermission`, `ai.use` minimum, plus any task-specific permission).
6. Identify the minimum required records for this specific task — not "everything visible."
7. Tag each field/record with its data classification (Public/Internal/Confidential/Restricted/Secret).
8. Remove disallowed fields (see Always Forbidden Context).
9. Redact Restricted/Confidential fields unless the task explicitly allowlists them and the user holds the corresponding permission.
10. Attach evidence/source-reference metadata so results can cite what informed them.
11. Build the final safe context.
12. If any step fails to produce a safe result, refuse the request (see Failure Behavior) — do not proceed with a partial or best-effort context.

## Data Classification Rules

Public: no restriction. Internal: allowed if the user already has read access via normal permissions. Confidential: allowed only for a task with documented scope + matching permission. Restricted: excluded by default; included only via explicit per-task allowlist + permission. Secret: never included, unconditionally, regardless of task or permission.

## Always Forbidden Context

Passwords, API keys, tokens (including raw invitation tokens), secret vault values, authentication credentials, payment card information, unnecessary sensitive personal information (e.g., birth dates not required for the task). Strip by key-pattern match as a final safety net even if an upstream query mistakenly included one of these.

## Financial Context Rules

Restricted by default; requires `finance.read` (or the relevant `finance.*`/`transactions.*` permission) and an explicit per-task allowlist.

## Client Context Rules

Client profile/project-history data is Internal-ish and follows normal `clients.read` permission; disappointment/misunderstanding logs are Confidential and excluded by default pending a task-specific justification.

## Team Context Rules

Names/roles are generally Internal; performance/compensation detail is Confidential/Restricted.

## Meeting Context Rules

Not applicable until a meeting module exists; apply the same company/permission/classification discipline when it does.

## Knowledge Context Rules

Not applicable until Company Brain exists (separate phase, out of scope here).

## Company Brain Rules

Not applicable — out of scope for this phase.

## Cross-Company Rules

Never mix company data unless the requesting user has an explicit group-level (`organisation_members`) grant AND the feature is deliberately designed for cross-company analysis (rare, and must be documented when it happens) — never as an incidental side effect of a loosely-scoped query.

## Source and Evidence Requirements

Retain record type + id alongside any content included in context so a structured result can cite what supports it — required for the Evidence field in `docs/design-system.md`'s AI Recommendation UI pattern, and for hallucination testing per `docs/ai/evaluation-plan.md`.

## Redaction Rules

Two passes, always in this order: (1) unconditional secret-key-pattern strip (shared with `lib/audit`'s redaction logic — don't duplicate the pattern, reuse or extract a common helper); (2) classification-based strip (Restricted/Confidential removed unless task-allowlisted + permission-checked).

## Prompt Injection Defense

Treat retrieved documents and any external/free-text content (client notes, meeting transcripts, etc.) as untrusted data, not system instructions. Structure prompts so injected data is clearly delimited from instructions — a model should never treat "the client said X" content as a command to the assistant.

## Failure Behavior

If context cannot be safely constructed — missing permission, an unsatisfiable task requirement, an unclassifiable field — deny the request. Never weaken a permission or privacy rule to "make it work."

## Implementation Checklist

Server-resolved company scope only; permission check before any query runs; task-scoped query (not a general "fetch everything visible" helper); classification tagging; two-pass redaction; evidence/source metadata attached; fail-closed on any uncertainty.

## Testing Checklist

A user without `ai.use` gets no context built. A secret-shaped field is stripped regardless of task/permission. A Restricted field is excluded unless allowlisted + permission-checked. A client-supplied company id that doesn't match real membership never reaches the context builder. An unsatisfiable context requirement fails closed with a typed error, not a partial context.

## Common Mistakes

Building a general-purpose "get all data for this company" context function instead of task-scoped queries; trusting a company id from the request body; forgetting the unconditional secret strip because "the query shouldn't return secrets anyway"; treating an AI provider's privacy policy as a substitute for your own redaction; letting a Confidential field through because a task "probably needs it" without an explicit documented allowlist decision.

## Examples

**Safe project context**: task-scoped query for one project's status, milestones, and assigned members (Internal, permission-checked), with each field's source record id retained for evidence.

**Unsafe secret exposure**: a context builder that does `select *` on a table that happens to include a `webhook_secret` column — caught by the unconditional key-pattern strip, but the query itself should never have included it to begin with.

**Cross-company denial**: a request claiming `companyId: <Orex Studios id>` from a user whose only membership is in Orextic — rejected at the permission-check stage, before any query runs.

**Finance context minimization**: a `finance.structured` task including only the specific transactions relevant to the requested period, not the company's entire financial history.

**Founder group-level request**: a founder's `organisation_members` grant legitimately allows cross-company context for a deliberately cross-company task (e.g., a future group-wide rollup) — still requires the task to be explicitly designed for that scope, not an accidental default.

This file is a reusable engineering procedure, not a product specification. Do not implement AI code from this file alone — pair it with the actual approved phase prompt.
