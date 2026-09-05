# Orex OS AI Context Policy

## Purpose

Define exactly what data is allowed to reach an AI provider, and the pipeline that enforces it, so that "the AI accidentally saw something it shouldn't have" is structurally prevented rather than dependent on every feature author remembering to filter correctly.

## Core Principles

AI context must be: permission-scoped (only data the requesting user could see anyway), company-scoped (only the resolved company's data), task-relevant (only what the specific task needs, not "everything available"), minimal (smallest sufficient set of records), redacted (Secret-classified fields always removed; Restricted-classified fields removed unless explicitly allowed for the task), and auditable (traceable which records/fields informed a given AI result, even if the routine call itself isn't written to the main audit log).

## Data Classification

Reuses the five-level classification already established in `docs/product-scope.md` and `docs/security.md` — Phase 002 does not invent a new scheme.

### Public

Non-sensitive, safe in any context, including AI. No restrictions.

### Internal

Normal operational data, company-scoped. Allowed in AI context for a user who already has read access to it via the normal permission system — the AI context builder never grants access the requesting user doesn't already have.

### Confidential

Sensitive business data (e.g., a client's disappointment log, financial detail). Allowed in AI context only when the specific task's documented scope includes it and the requesting user holds the corresponding permission (e.g., `finance.read` for financial context) — not included by default in a general-purpose context builder.

### Restricted

Permission-gated data requiring elevated access (e.g., finance approval records, team performance detail). Included in AI context only via an explicit, per-task allowlist decision documented at the time that task is built — the context builder defaults to excluding Restricted data unless a task alias's definition says otherwise.

### Secret

Credentials, API keys, tokens, vault values, payment card data. **Never** sent to an AI provider under any circumstance, for any task, regardless of permission. The redaction pass removes these unconditionally, as a final safety net even if an upstream query mistakenly included them.

## Allowed AI Context

Public and Internal data the requesting user already has permission to read, scoped to the resolved company, filtered to what the specific task declares it needs. Confidential/Restricted data only per the per-task allowlist described above.

## Disallowed AI Context

Always excluded, unconditionally, regardless of task or permission: passwords, API keys, access tokens, authentication secrets (session tokens, invitation raw tokens), payment card information, secret vault values, and any field whose key matches the secret-shaped pattern already used by `lib/audit`'s redaction (`token|password|secret|api_key|apikey|access_key`, extended as needed for AI-specific fields like `encrypted_password`).

## Company Isolation

Identical rule to every other part of Orex OS: the company scope used to build AI context is resolved server-side from the caller's real membership/organisation-level grant (`lib/permissions`), never from a client-supplied company id in the AI request payload. A request whose caller has no access to the claimed company fails at the permission-check stage, before the context builder runs at all — there is no path where "the AI context builder queried the wrong company" is even reachable, because it never receives an unverified company id to query with.

## User Permission Filtering

The context builder queries data using the same permission-aware access patterns as normal server actions (ultimately backed by the same RLS policies) — it does not use a privileged/service-role path to "see more than the user could." If a future task genuinely needs cross-permission aggregation (e.g., an org-wide summary a Manager doesn't have full visibility into), that is an explicit, documented, task-specific design decision requiring its own permission check — never a default gateway behavior.

## Minimum Necessary Context

Each task alias declares what record types and fields it needs (see `docs/ai/model-routing.md` per-alias documentation, "context requirement"). The context builder is intentionally *not* a general-purpose "fetch everything visible" function — it exists per task or per task category, so adding a new AI feature requires a conscious decision about what data it touches, not an accidental default of "everything."

## Personal Data Minimization

Only necessary personal data (names, roles, work-relevant contact info) is included; unnecessary personal details (per AGENTS.md §15: unnecessary birth dates, sensitive personal data) are excluded by default and would require an explicit, justified task-specific allowance to include.

## Client Data

Company-scoped, gated by `clients.read`. Disappointment/misunderstanding logs (Confidential, per `docs/product-scope.md`) are excluded from AI context by default per the Confidential rule above, pending a task that explicitly justifies including them (e.g., a future client-health analysis feature) with its own documented rationale.

## Financial Data

Restricted, gated by `finance.read`/`finance.*`, excluded from AI context by default per the Restricted rule above.

## Team Data

Internal (names, roles) is generally includable per normal permission rules; performance/compensation-adjacent detail is Confidential/Restricted and follows those stricter rules.

## Meeting Data

Not applicable in Phase 002 — no meeting module exists yet. Future meeting-brief context will follow the same company/permission/classification rules.

## Knowledge Data

Implemented in Phase 003 (CLOSED). `lib/knowledge/retrieval.ts` is the one reusable retrieval implementation for both the `/brain` UI and any AI context builder — it authenticates, checks `knowledge.read` at the correct scope (company or organisation), then queries `match_knowledge_chunks()`, which is RLS-enforced (not `SECURITY DEFINER`), so a forged or out-of-scope company id returns zero rows regardless of the caller's own logic. Every retrieved chunk carries its `knowledge_items` classification, which flows into `lib/ai/context-builder.ts`'s existing redaction/classification pipeline unchanged — Phase 003 is simply the first real caller supplying real classified fields instead of test fixtures.

## Company Brain Context

Implemented in Phase 003 (CLOSED). Two real consumers: `knowledge.extract` (pasted-text fact extraction — output always lands as `origin_type: "ai_extracted"`, `verification_status: "candidate"`, never auto-verified) and `advisor.deep` (the minimal read-only `askCompanyBrain` capability, which retrieves relevant knowledge and answers with a cited source list, or an honest "no matching knowledge found" rather than an invented answer). Secret-classified knowledge is structurally excluded from both — it is never chunked or embedded in the first place, so it can never be retrieved into context regardless of what a context-assembly bug might otherwise attempt. Both task aliases' `sensitivityAllowance` is enforced at the router level (`lib/ai/sensitivity.ts`, added in the Phase 003 hardening pass) in addition to this classification/redaction pipeline — the two checks are independent and both required.

## Context Freshness

Not enforced by Phase 002's infrastructure directly (no caching layer is introduced); each gateway call queries current data at request time. A future phase adding caching must preserve permission/company scoping on cache reads, not just on the original query.

## Source References

Where a task's context includes specific records, the context builder should retain enough identifying reference (record type + id) alongside the content so a structured result can cite its sources — this supports the future "Evidence" requirement in `docs/design-system.md`'s AI Recommendation UI, though Phase 002 itself builds no UI.

## Context Builder Pipeline

```
task alias + resolved company + resolved user
→ task-specific query (permission-aware, same access patterns as normal reads)
→ tag each field/record with its data-sensitivity classification
→ redaction pipeline (strip Secret always; strip Restricted unless task-allowlisted; strip Confidential unless task-allowlisted + permission held)
→ minimality check (only task-declared fields survive)
→ final safe context
```

If any stage cannot produce a safe context (e.g., a required permission is missing, or a task's declared context requirement can't be satisfied), the pipeline fails closed — see Failure Behavior.

## Redaction Pipeline

Two passes: (1) unconditional secret-key-pattern strip (same mechanism as `lib/audit`'s existing redaction, extracted into a shared helper both `lib/audit` and `lib/ai` can use so the pattern isn't duplicated and can't drift); (2) classification-based strip (Restricted/Confidential fields removed unless the task's declared allowlist and the user's permission both allow them).

## Prompt Injection Handling

Out of scope for Phase 002's infrastructure layer in depth (no real business-data context builder exists yet to inject into) — flagged as a required design concern for the first real feature that assembles context from free-text business records (client notes, meeting transcripts, etc.). At minimum, future context builders should clearly delimit "data" from "instructions" in the prompt structure so a model is less likely to treat embedded record content as a command.

## External Content Handling

Not applicable in Phase 002 (no external content ingestion exists yet).

## Context Audit Logging

Per `docs/ai/openrouter-architecture.md`'s Audit vs Usage distinction: routine context construction is captured in the usage record (which records/permission scope were touched, at a summary level — not full content), not written as an individual `audit_logs` row. A context-construction *failure* due to a permission or classification violation is worth a normal usage-record entry with a failure status; it does not need a separate audit-log entry unless it represents a genuine security event (e.g., repeated attempts to access another company's data via AI).

## AI Provider Privacy Rules

OpenRouter is treated as a third-party data processor: only data cleared by this policy's redaction pipeline is sent. No assumption is made about OpenRouter's or the underlying model provider's own data retention — Orex OS's obligation is to never send data that shouldn't leave the server in the first place, independent of what any provider promises to do with it afterward.

## Restricted Data Approval

A task alias that needs Restricted-classified data declares that need explicitly in its alias definition (see `docs/ai/model-routing.md`), and the gateway still requires the calling user to hold the specific permission that would let them see that data through normal channels (e.g., `finance.read`) — the allowlist relaxes the *default exclusion*, it never relaxes the *permission check*.

## Failure Behavior

If a safe context cannot be built — a required permission is missing, a task's declared context requirement can't be satisfied without violating a classification rule, or the redaction pipeline can't confidently classify a field — the gateway refuses the request with a typed error (`CONTEXT_CONSTRUCTION_FAILED` or `PERMISSION_DENIED`, per `prompts/002-openrouter-gateway.md` Error Handling) rather than proceeding with a best-effort, potentially-unsafe context.

## Test Cases

1. A user without `ai.use` for a company cannot get any AI context built for that company.
2. A field matching the secret-key pattern is stripped from context regardless of task or permission.
3. A Restricted-classified field is excluded unless the task explicitly allowlists it AND the user holds the corresponding permission.
4. A client-supplied company id that doesn't match the caller's real membership never reaches the context builder (rejected at the permission-check stage).
5. A task whose declared context requirement cannot be satisfied (e.g., missing required permission) fails closed with a typed error, not a partial/empty context silently passed through.

## Open Questions

1. Should the classification tag live on each database column (a `data_classification` metadata concept) or be declared per-query in the context builder itself? This document assumes per-query declaration for Phase 002 (no real business-data tables exist yet to tag), revisit once real operational modules (finance, clients) are built.
2. How should the "task's declared context requirement" actually be expressed in code — a static per-alias config object, or a per-task function? Left to `prompts/002-openrouter-gateway.md`'s Files/Architecture sections to resolve concretely.

Then stop.
