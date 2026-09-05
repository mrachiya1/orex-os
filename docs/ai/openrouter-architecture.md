# OpenRouter Architecture

## Purpose

Define the single server-side AI gateway Orex OS routes every model call through, so that no product feature ever talks to OpenRouter (or any model provider) directly, and every AI interaction inherits the same authentication, authorization, company-isolation, redaction, logging, and audit guarantees Phase 001 already built for ordinary data access.

## Why Orex OS Uses an AI Gateway

AGENTS.md §10 treats AI as controlled decision support, not an unrestricted administrator. If every feature module instantiated its own OpenRouter client, each one would need to independently reimplement permission checks, company scoping, secret redaction, and audit logging — and any one omission would be a silent security hole. A single gateway makes those guarantees structural: a feature literally cannot reach a model without passing through them.

## Server-Only Requirement

The OpenRouter client and API key exist only in server code (`lib/ai/`), imported only by server actions/route handlers. No client component, no `"use client"` file, and no code shipped to the browser bundle may reference `OPENROUTER_API_KEY` or import the gateway's server-only modules — enforced the same way Phase 001 enforced it for `SUPABASE_SERVICE_ROLE_KEY`: the `server-only` package at the top of every file in the boundary, verified by scanning the built `.next/static` bundle for the key string.

## Gateway Responsibilities

Given a task alias, a company/user context, and task-specific input, the gateway: authenticates the caller, resolves their permission for the requested task, resolves company scope, builds and redacts AI context, routes to a model via the alias registry, calls OpenRouter with retry/fallback, validates the structured response, records usage, and returns a typed result (or a safe, typed error). No caller-supplied model id, provider id, or raw prompt bypasses this pipeline.

## Proposed File Structure

See `prompts/002-openrouter-gateway.md` "Files Expected to Be Created" for the authoritative, repository-verified list. Conceptually: a server-only OpenRouter client, a gateway entrypoint feature code calls, a model router resolving aliases to real models, a context builder + redaction pipeline, a structured-output validator, a usage-tracking writer, and normalized error types. Not created by this document.

## Request Lifecycle

```
Feature code
→ Orex AI gateway entrypoint (task alias + typed input)
→ authenticate (lib/auth/session, same as Phase 001)
→ resolve company scope (server-derived, never client-trusted, same rule as Phase 001)
→ permission check (lib/permissions.hasPermission, ai.use at minimum)
→ context builder (assembles only the records the task needs)
→ context policy / redaction (strips Secret-classified fields, enforces Restricted-data rules)
→ model router (alias → primary model, fallback chain)
→ OpenRouter API call (with timeout + retry)
→ structured-output validation (Zod schema per task)
→ usage tracking write
→ typed result (or typed, safe error)
→ Feature code
```

## Authentication

Reuses `lib/auth.getCurrentUser()`/`requireCurrentUser()` verbatim — no new session mechanism. An AI request with no verified session is rejected before any context is built or any OpenRouter call is made.

## Authorization

Reuses `lib/permissions.hasPermission()`/`requirePermission()` verbatim. Every AI request checks `ai.use` for the target company at minimum; task-specific gateways may require additional permissions (e.g., a future finance-analysis task would also require `finance.read`). No new permission-resolution logic is introduced — Phase 002 is a new *caller* of the existing system, not a new authorization mechanism.

## Company Scope

Identical rule to every other Phase 001 mutation/read: the company id used for permission checks and context queries is resolved server-side from the caller's real membership (or organisation-level grant), never accepted verbatim from client input. A request that claims a company id the caller has no membership in fails at the permission check, before any context is built — see `docs/ai/context-policy.md` Company Isolation.

## Context Building

The context builder assembles the minimum set of records a specific task actually needs (never "all data the user can see"), tagged with each record's data-sensitivity classification. See `docs/ai/context-policy.md`.

## Context Redaction

Before any context leaves the server process, Secret-classified fields are removed unconditionally, and Restricted-classified fields are removed unless the specific task has an explicit, documented allowance. Reuses the same redaction-by-key-pattern approach already implemented in `lib/audit` (secret-shaped keys stripped before persistence) as a starting pattern, extended with a data-classification-aware pass. See `docs/ai/context-policy.md`.

## Model Routing

Feature code requests a task alias (e.g. `advisor.deep`), never a provider model id. The router resolves the alias to a primary model and an ordered fallback list from a static registry (configuration, not architecture). See `docs/ai/model-routing.md`.

## Fallback Strategy

If the primary model for an alias fails (timeout, rate limit, provider error, invalid response), the router retries against the next model in the alias's fallback list, up to a small bounded number of attempts. If the fallback chain is exhausted, the gateway returns a typed `FALLBACK_EXHAUSTED` error rather than a partial or fabricated result — see Error Handling below and `docs/ai/model-routing.md`.

## Structured Outputs

Every task alias declares a Zod schema for its expected result shape. The gateway parses the model's response against that schema; a response that fails validation is treated as a failure (typed `INVALID_STRUCTURED_OUTPUT` error), never silently coerced or partially trusted. See "Structured Output Requirements" in `prompts/002-openrouter-gateway.md`.

## Tool Calling

Phase 002 establishes only the parsing foundation for a future tool-call response (recognizing that a model proposed calling a named tool with arguments) — it does not register any real tools, grant database access, or execute anything. Any future mutation-capable tool must go through the safe AI action architecture in `docs/ai/ai-action-policy.md`, never a direct database call from AI-generated content.

## Human Approval

Not exercised in Phase 002 (no mutation-capable tools exist yet). The gateway's result type includes room for an `actionProposal` field so a future phase can add approval-gated mutations without changing the gateway's core shape — see `docs/ai/ai-action-policy.md`.

## AI Audit Logging

Not every AI call is a security-relevant audit event (see "AI usage event vs AI audit event" distinction in `docs/ai/evaluation-plan.md`'s sibling discussion and `prompts/002-openrouter-gateway.md` Audit Integration). Usage is tracked per-call in a dedicated usage store; the shared `audit_logs` table records only the security-relevant categories (e.g., a permission-denied AI request, a rejected structured output on a mutation-adjacent task) — Phase 002 does not write a Phase-001-style audit row for every successful read-only AI call, to avoid drowning the audit log in token-level noise.

## Usage Tracking

Every gateway call — success or failure — records: actor, organisation/company, task alias, resolved model, provider, input/output/total tokens, estimated cost, latency, result status, prompt version, and (on failure) a normalized error classification. Never the raw prompt/response content if it could contain Secret-classified data — see "Usage and Cost Logging" in `prompts/002-openrouter-gateway.md`.

## Timeouts

Every OpenRouter call has a bounded timeout (a task-alias-configurable value, defaulting to a conservative ceiling); a timeout is treated as a fallback-triggering failure, not a hang.

## Provider Errors

OpenRouter/provider errors are caught, classified into Orex OS's own normalized error taxonomy (see Error Handling), and never surfaced to the caller with raw provider error text (which could contain provider-internal details) or the API key.

## Retry Rules

A small bounded number of retries (e.g., one immediate retry) is attempted for transient errors (timeout, 5xx, rate limit) against the *same* model before falling back to the next model in the alias's chain; non-transient errors (structured-output validation failure, permission denied) do not retry — they fail immediately with the appropriate typed error.

## Rate Limits

Phase 002 establishes the *handling* for a rate-limit response from OpenRouter (classify, retry/fallback per the rules above) but does not implement Orex OS's own inbound rate limiting on who can call the gateway how often — that's listed as a known Phase 001 carryover risk (no rate limiting on any endpoint yet) and remains open for a future phase.

## Privacy Controls

Governed entirely by `docs/ai/context-policy.md` and the data-sensitivity classifications already established in `docs/product-scope.md` and `docs/security.md`.

## Secret Handling

`OPENROUTER_API_KEY` is a server-only environment variable, never logged, never included in usage records, never included in AI context, never returned in any error message. Application secrets (Supabase keys, Resend key) are excluded from AI context by the same redaction pass that excludes vault-classified secrets — the context builder never has access to environment variables in the first place, only to database records it explicitly queries.

## Observability

Usage records (see Usage Tracking) are the primary observability surface for Phase 002 — no external APM/tracing integration is introduced. Structured console logging for gateway-internal errors follows the same "never log secrets" rule as the rest of the codebase (`docs/security.md` Logging Policy).

## Model Provider Independence

Feature code imports the gateway's public interface (task alias + typed input → typed result), never an OpenRouter SDK type or a specific model's request/response shape. Swapping a model, or even swapping OpenRouter for a different aggregator in the future, should require changing only `lib/ai/model-registry.ts` and the client adapter, not any feature code.

## Phase 002 Boundary

Phase 002 builds the gateway, routing, redaction, structured-output validation, usage tracking, and error handling described above. It does not build Company Brain, autonomous agents, any specific product AI feature (Advisor, Finance Agent, Risk Agent, etc.), or real tool execution — those are later phases that will be the gateway's first real callers.

## Security Risks

1. A future feature bypassing the gateway and calling OpenRouter directly would silently lose every guarantee here — mitigated by making `OPENROUTER_API_KEY` accessible only from within `lib/ai/` server-only modules and documenting the "no feature instantiates its own client" rule as a hard rule in this doc and in `AGENTS.md`-style review.
2. Prompt injection via context data (e.g., a client's disappointment-log note containing instructions aimed at the model) is a real risk once real product data flows through the context builder — Phase 002's redaction pipeline addresses data *sensitivity*, not prompt-injection content sanitization; this is flagged as an open risk for the context-builder work in later phases that actually assemble real business context.
3. Cost runaway from an unbounded retry/fallback loop — mitigated by the small bounded retry/fallback counts specified above.

## Open Questions

1. Should Phase 002 include a minimal internal diagnostic endpoint/page (dev-only) to manually exercise the gateway with a test alias, or is unit/integration testing sufficient without one? See `prompts/002-openrouter-gateway.md` UI Scope.
2. Should usage records live in a new Phase 002 table, or is there a lighter-weight approach (e.g., structured logs only) sufficient until real usage volume exists? See `prompts/002-openrouter-gateway.md` Database Impact.

Then stop.
