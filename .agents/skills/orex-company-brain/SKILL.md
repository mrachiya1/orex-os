# Orex Company Brain

## Purpose

Reusable procedure for designing and extending Orex OS's organisational memory. Full architecture and rationale live in `prompts/003-company-brain.md` — this skill is the actionable checklist for any code that stores, ingests, retrieves, or displays company knowledge, in this phase or any later one that adds a new knowledge domain.

## Core Principle

Company Brain is organisational memory, not model retraining. Nothing here changes a model's weights or its general behavior — it only changes what real, attributable company data a request is allowed to read before asking a model to answer.

## Memory Types

Semantic memory (stable facts: vision, mission, services, pricing, rules), episodic memory (things that happened: project events, client events, daily-log events), decision memory (a decision plus what actually happened after it), procedural memory (SOPs, workflows, delivery/QA/finance processes). All four share one storage shape (`knowledge_items` + `knowledge_sources` + `knowledge_chunks`) except decisions, which use their own `decisions`/`decision_reviews` tables because a decision has a distinct lifecycle (proposed → decided → reviewed) that doesn't fit a knowledge item's verification/freshness lifecycle.

## Knowledge State Model

Four independent dimensions on every `knowledge_items` row — never collapse these into one status field:

- `item_type` — what kind of knowledge (`fact`, `document`, `vision`, `mission`, `goal`, `service`, `strategy`, `rule`, `policy`, `process`, `sop`, `lesson`, `win`, `failure`, `research`).
- `origin_type` — who/what produced it (`human`, `ai_extracted`, `system`).
- `verification_status` — has a human attested it (`candidate`, `verified`, `rejected`).
- `lifecycle_status` — is it still current (`current`, `stale`, `superseded`, `archived`).

## Verified Facts vs AI Inference — the one rule that must never be violated

A row may never be inserted or updated with `origin_type = 'ai_extracted'` AND `verification_status = 'verified'` in the same write. Every AI-authored write (from `knowledge.extract` fact extraction, or from any future ingestion path) lands as `verification_status = 'candidate'`, full stop, regardless of the model's self-reported confidence. Promotion to `verified` is a separate, explicit, audited (`knowledge.verified`) action performed by a human holding `knowledge.verify` — never a side effect of ingestion, never automatic, never inferred from a high confidence score. Enforce this in the server action that performs the insert/update, not only as a UI convention — a malicious or buggy client payload must not be able to set `verification_status: 'verified'` directly.

## Knowledge Sources

Every `knowledge_items` row references exactly one `knowledge_sources` row recording what produced it (`manual_entry`, `pasted_text`, or a future real source like `project`/`client`/`meeting`/`daily_log` once those tables exist). Never insert a `knowledge_items` row without first resolving or creating its source — an unattributed fact is not company knowledge, it's an assumption.

## Documents and Chunks

A `knowledge_items` row with `item_type` other than `fact` and long-form `content` gets split into `knowledge_chunks` for retrieval. Chunking is semantic-structure-first, not arbitrary token slicing:
- Atomic facts: never chunked — one chunk (`chunk_index = 0`) containing the fact verbatim.
- Short structured items: one chunk per logical section.
- Long prose/documents: target ~450-650 tokens per chunk, ~75 tokens of overlap where continuity improves retrieval, split on headings/paragraph boundaries.
- SOPs/processes: split by logical process step, not by arbitrary length.
- Decision records: keep the core decision context (situation + evidence + chosen action) together in one chunk where practical, rather than fragmenting a single decision's reasoning across chunks.

## Facts

A "fact" (`item_type = 'fact'`) is a short, atomic statement. It is always exactly one chunk. Prefer `fact` for anything expressible as one sentence (a pricing principle, a single rule); use `document` or a more specific `item_type` for anything that needs structure or length (an SOP, a strategy write-up).

## Embeddings

Generated only through `lib/ai/embeddings.ts`, the sole module allowed to call OpenRouter's embeddings endpoint (mirrors `lib/ai/client.ts`'s isolation of chat completions — no other module may import `@openrouter/sdk` for embeddings or anything else). Model and dimension are configuration (`OPENROUTER_EMBEDDING_MODEL`, currently `openai/text-embedding-3-small` at 1536 dimensions) but the `vector(1536)` column width is fixed for this schema version — changing the embedding model to one with a different output dimension requires an explicit migration, re-embedding every existing chunk, and an index rebuild; it is never a silent runtime model swap. Secret-classified content is never embedded — checked before the embeddings call, not after. Confidential/Restricted content passes through the same `lib/ai/privacy.ts` provider-preference rules as any chat completion before being embedded.

## Retrieval

One retrieval implementation (`lib/knowledge/retrieval.ts`) serves both the Company Brain UI's search and any AI feature's context assembly — never build a second, separate semantic-search path for either consumer. Retrieval always: authenticates → resolves company/group authorization → checks `knowledge.read` → applies structured filters → runs the vector similarity query → returns typed, source-backed results. RLS enforces scoping at the database layer regardless of what the caller's query parameters claim — never rely on application code to filter out rows a raw query could have returned.

## Source References

Every retrieval result carries its originating `knowledge_items` id and `knowledge_sources` info so any UI or AI answer can cite what supports it. An AI answer built from retrieved knowledge must always be rendered with its source list — never as unattributed prose asserted as fact.

## Confidence

Only meaningful on `origin_type = 'ai_extracted'` rows. Never display a confidence score next to a `verified` fact — a human's verification is not a probability. Retrieval ranking should prefer `verification_status = 'verified'` rows over `candidate` rows at equal similarity, but a candidate can still surface (clearly labelled) if nothing verified matches — never hide the only relevant knowledge just because it hasn't been verified yet.

## Freshness

`lifecycle_status`: `current` → `stale` (a human-flagged signal, no automated staleness detection in Phase 003) → `superseded` (a newer row exists, linked via `superseded_by`) → `archived` (retired, excluded from default views/retrieval, never deleted). Never hard-delete a `knowledge_items` row. Superseding creates a new row rather than overwriting the old one in place, so history is always inspectable.

## Company Scope / Group Scope / Cross-Company Knowledge

`company_id` non-null → visible only to members of that company (or an org-level grant covering it). `company_id` null → Orex Group-level, visible only to an org-level `knowledge.read` grant (in practice, the founder). A company-level `knowledge.read` grant never exposes group-level or another company's rows — cross-company or group access always requires the organisation-level permission check (`has_org_permission`/`hasOrgPermission`), never inferred from a company-level permission alone. See `.agents/skills/orex-rls-security/SKILL.md` for the exact policy shape.

## Knowledge Ingestion Workflow

```
author input (manual entry, or pasted text)
→ auth + knowledge.create permission check
→ content normalization
→ classification (author-selected, defaults to internal)
→ [pasted text only] knowledge.extract AI call → candidate items,
   always origin_type='ai_extracted', verification_status='candidate'
→ [manual entry] one item, origin_type='human', verification_status
   author-selectable (a human can self-verify what they just typed,
   requires knowledge.verify to do so — knowledge.create alone cannot)
→ knowledge_sources row created/linked
→ chunking → embedding generation (classification-gated) → knowledge_chunks
→ retrievable immediately (no separate publish step — verification_status
   and lifecycle_status are always visible alongside any retrieved result,
   so an unverified candidate is never presented as equivalent to
   verified knowledge)
```

## Daily Learning Workflow

Not built in Phase 003. The `knowledge_sources.source_type` enum reserves values (`project`, `client`, `meeting`, `daily_log`, `system_event`) for a future phase where operational events can become episodic memory automatically. When that phase ships: an operational event may become a `knowledge_items` candidate (`origin_type = 'system'` or `'ai_extracted'`, `verification_status = 'candidate'`), never a verified fact, and a repeated pattern across many events may become an insight worth a human's attention — but nothing in that future pipeline may skip the human verification step described above.

## Decision Memory

`decisions` stores: title, owner, status (proposed/decided/in_review/closed), situation, evidence, options, an optionally-populated `ai_recommendation` (always rendered as AI-labelled, never auto-copied into `chosen_action`), chosen action, expected result, decision/review dates, and an optional link to a related `knowledge_items` row (e.g., a lesson the decision produced). `decision_reviews` is a separate, append-style table — a decision can be reviewed more than once over time (a 90-day check-in, then a 1-year retrospective), and each review is preserved, never overwriting an earlier one.

## Retrieval Rules

Never return a row the caller's RLS-enforced query wouldn't independently return. Never rank an unverified candidate above a verified fact at meaningfully higher similarity without labelling which is which in the result. Always include `verification_status`, `lifecycle_status`, and `classification` in every retrieval result, not just `content`.

## AI Context Rules

Follow `.agents/skills/orex-ai-context-policy/SKILL.md` in full — Company Brain retrieval is explicitly named there as a context-assembly path. Secret-classified knowledge is never included in any context; Confidential/Restricted knowledge follows the existing Phase 002 provider-routing rules unchanged.

## Security Rules

`ai.use` is necessary but never sufficient for a Company Brain AI feature — always check `knowledge.read` (or the relevant `decisions.*` permission) in addition, per the founder's explicit instruction that AI permission must never substitute for data permission. AI is never given a write path to `knowledge_items`/`decisions` directly (see `.agents/skills/orex-safe-ai-actions/SKILL.md`) — every AI output is application data first, and a human-gated server action decides whether it becomes a row.

## Data Quality Rules

Prefer `fact` for atomic statements over stuffing everything into `document`. Set `classification` deliberately at creation time — don't default everything to `internal` without considering whether it's actually `confidential`/`restricted`. A `knowledge_items` row without a resolvable `source_id` should never be possible.

## Duplicate Knowledge Rules

Phase 003 does not implement automatic duplicate detection. When creating knowledge, prefer updating/superseding an existing current item over creating a near-duplicate — this is a UI/process discipline for now, not an enforced database constraint.

## Updating Existing Knowledge

Editing a `candidate` or unverified item in place (before it's ever been verified) is a normal update. Once a fact is `verified` and something changes, create a new item and mark the old one `superseded` via `superseded_by` — never edit a verified fact's `content` in place, since that would silently rewrite something a human already attested to.

## Archiving Knowledge

Sets `lifecycle_status = 'archived'`. Reversible (unarchiving is just another update). Archived items are excluded from default retrieval/UI views but remain queryable with an explicit filter — never physically deleted.

## Testing Checklist

A cross-company retrieval attempt returns zero rows, not an error leaking existence. An AI-extracted item is never inserted with `verification_status = 'verified'`. A user without `knowledge.verify` cannot flip `verification_status` regardless of what the client sends. Archiving/superseding preserves the original row and its full audit trail. A Secret-classified item is never embedded and never appears in any AI context. Retrieval never returns a row RLS would deny to a direct query.

## Common Mistakes

Collapsing the four state dimensions into one status column (loses the ability to ask "is this human-authored" independently of "is this verified"). Auto-verifying high-confidence AI extractions "because the model seemed sure." Building a second semantic-search implementation for the UI instead of reusing `lib/knowledge/retrieval.ts`. Hard-deleting a superseded or archived item. Treating `ai.use` as sufficient authorization for a Company Brain feature without also checking `knowledge.read`.

## Example Workflows

**Manual verified entry**: a Director types "Our mission is X" directly, selects `item_type: mission`, checks the founder-approved box to mark it verified immediately (requires `knowledge.verify`) — one `knowledge_items` row, `origin_type: human`, `verification_status: verified`, `verified_by`/`verified_at` populated, one audit event (`knowledge.created`).

**AI-assisted candidate**: a Manager pastes a rough SOP draft; `knowledge.extract` proposes three candidate `sop`/`rule` items, all `origin_type: ai_extracted`, `verification_status: candidate`, each with a `confidence` score; none are retrievable as "verified" anywhere until a Director reviews and verifies each one individually (`knowledge.verified` audit event per approval).

**Cross-company denial**: a Orextic-only Manager's retrieval query for "pricing strategy" never returns an Orex Studios `knowledge_items` row, even if the query text happens to match — RLS denies it before the application code ever sees it.

This file is a reusable engineering procedure, not a product specification. Pair it with `prompts/003-company-brain.md` for the actual approved phase scope; do not use this file alone to justify building something outside that scope.
