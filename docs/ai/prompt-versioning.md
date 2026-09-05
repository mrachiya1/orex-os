# Orex OS Prompt Versioning

## Purpose

Ensure every AI-generated result can be traced back to the exact prompt that produced it — required for debugging, evaluation (`docs/ai/evaluation-plan.md`), auditability (`docs/ai/openrouter-architecture.md`'s usage records include `prompt_version`), and safe rollback if a prompt change regresses quality or safety.

## Prompt Categories

System prompts (gateway/task-level framing), agent prompts (future AI Agents module), builder prompts (future Create/Builder Layer), extraction prompts (`knowledge.extract`-style tasks), classification prompts (categorization/risk-scoring tasks), action prompts (future AI Mutation Requests, per `docs/ai/ai-action-policy.md`).

## File Organisation

Prompt templates live alongside the task alias that uses them, under `lib/ai/prompts/<alias>/` (e.g., `lib/ai/prompts/advisor.deep/v1.ts`), as versioned TypeScript modules exporting the prompt template plus its metadata — not free-floating text files, so they're type-checked and reviewable via normal code review, consistent with `docs/ai/model-routing.md`'s "configuration reviewed like code" approach. Phase 002 does not create any real prompt files (no task alias is wired to a real feature yet) — this defines where they'll go.

## Prompt IDs

A stable identifier combining the task alias and a purpose suffix if a task needs multiple distinct prompts (e.g., `advisor.deep.system`, `advisor.deep.summarize`).

## Semantic Versions

Simple integer versions per prompt id (`v1`, `v2`, ...) rather than full semver — prompts don't have meaningful "patch vs. major" distinctions the way code does; any change that alters model behavior is a new version.

## Prompt Metadata

Each prompt version module exports: `promptId`, `version`, `createdAt`, `createdBy`, `status` (draft/active/deprecated), `modelCompatibility` (which aliases/models it's verified against), and `changeReason` (why this version exists vs. the last one). Stored as a code-level export, not a database row, in Phase 002 (see Database Relationship below).

## Draft Prompts

A new prompt version starts as `draft` — usable in development/testing but not selected by the gateway for real traffic until promoted to `active`.

## Active Prompts

The `active` version is what the gateway actually uses for a given prompt id at runtime. Only one version per prompt id is `active` at a time.

## Deprecated Prompts

A superseded version is marked `deprecated`, kept in the codebase (for audit/rollback traceability — a past usage record's `prompt_version` should still resolve to real prompt content if ever needed for debugging), but no longer selected.

## Prompt Change Review

Since prompts live in code, a prompt change goes through the same review as any other code change (PR review) — no separate approval system is built in Phase 002.

## Testing Before Activation

Per `docs/ai/evaluation-plan.md`: a new prompt version should be evaluated against that task's relevant test cases before promotion from `draft` to `active`, not swapped in purely because it "seems better."

## Rollback

Reverting `active` from a new version back to the prior one is a one-line metadata change (which version is marked active) plus a normal code deploy — no data migration, since prompts aren't stored in the database in Phase 002.

## Prompt Audit History

Git history is the audit trail for prompt *content* changes (per Git Relationship below). The `prompt_version` field recorded on every usage record (`docs/ai/openrouter-architecture.md`) is the audit trail for *which version produced which result*.

## Model Compatibility

A prompt version's `modelCompatibility` metadata flags which models/aliases it's been verified against — relevant because prompt phrasing that works well for one model family may not transfer perfectly to another; changing a task alias's primary model (per `docs/ai/model-routing.md`) should prompt a check of whether its active prompt version still performs well.

## Company-Specific Context

Prompts are never forked per company. Company-specific context (name, accent, industry) is injected as data into a shared prompt template at request time, not hard-coded into per-company prompt copies — consistent with `docs/architecture.md`'s module-plugin principle that new companies must never require code changes.

## Safety Rules

A prompt template must never itself embed secrets, and must clearly separate "injected data" from "instructions to the model" in its structure (relevant to the prompt-injection concern flagged in `docs/ai/context-policy.md`) — enforced by review, not by automated tooling in Phase 002.

## Git Relationship

Prompt version files are ordinary tracked source files — their history, blame, and PR review trail come entirely from git, with no parallel versioning system to keep in sync.

## Database Relationship

None in Phase 002. Prompts are code, not data. If a future phase needs non-engineers to edit prompts without a deploy (e.g., a prompt-authoring admin UI), that would introduce a database-backed prompt store at that time — explicitly not built now, to avoid the exact kind of premature infrastructure AGENTS.md §2 warns against.

## Future Admin UI

Not built in Phase 002 (see UI Scope in `prompts/002-openrouter-gateway.md`) and not required until prompt-editing-by-non-engineers becomes a real need.

## Open Questions

1. Should `modelCompatibility` be enforced at runtime (gateway refuses to use a prompt version against an unlisted model) or treated as documentation-only for now? This document assumes documentation-only for Phase 002 scope (no real prompts exist yet to enforce against).

Then stop.
