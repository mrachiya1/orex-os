# Phase 003: Company Brain

## Status

APPROVED (2026-09-05) — all Open Questions (§34) resolved by the founder. Recorded decisions:

1. **Embeddings**: OpenRouter's embeddings capability via the existing `@openrouter/sdk` (confirmed present: `openRouter.embeddings.generate()`), isolated behind `lib/ai/embeddings.ts` — no second AI provider SDK. Model `openai/text-embedding-3-small`, `dimensions: 1536`, cosine similarity, `vector(1536)` + HNSW/`vector_cosine_ops`. New env var `OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small`. Dimensionality is fixed for this schema version; a future model change requires an explicit migration, re-embedding, and index rebuild.
2. **Minimal read-only Q&A**: included, read-only only (no mutation, no verification, no decisions, no tools, no external communication).
3. **Permission matrix**: founder's exact role table adopted verbatim (superseding this document's originally-proposed matrix) — see §19.
4. **Knowledge state model**: four separate dimensions instead of one `status` field — `item_type` (fact/document/vision/mission/goal/service/strategy/rule/policy/process/sop/lesson/win/failure/research), `origin_type` (human/ai_extracted/system), `verification_status` (candidate/verified/rejected), `lifecycle_status` (current/stale/superseded/archived) — superseding this document's originally-proposed single `status` column. AI-generated knowledge always starts `origin_type = ai_extracted`, `verification_status = candidate`.
5. **Chunking**: semantic-structure-first (atomic facts unchunked; short items one chunk per logical section; long prose ~450-650 tokens with ~75-token overlap where continuity helps; SOPs split by process step) — supersedes the originally-proposed fixed ~500-token/no-overlap default.
6. **Data model**: proceed with the five originally-proposed tables (`knowledge_sources`, `knowledge_items`, `knowledge_chunks`, `decisions`, `decision_reviews`); still no `knowledge_documents`/`knowledge_facts`/`knowledge_embeddings`/`insight_candidates`.
7. **Retrieval**: one reusable implementation for both UI and AI, per §14, unchanged from the original proposal.
8. **Skills**: `.agents/skills/{orex-company-brain,orex-audit-system,orex-rls-security,orex-test-security,orex-design-system}/SKILL.md` to be filled with real content before application code, resolving Open Question §34.4.
9. **UI**: compact tabbed `/brain` interface per §22, unchanged from the original proposal.
10. **Audit**: `knowledge.created/updated/verified/rejected/superseded/archived`, `decision.created/updated/reviewed` — `rejected` added to the originally-proposed event list per the new `verification_status` model.

Implementation proceeding under this approval. No further planning gate unless a genuine architecture conflict is discovered.

### CLOSED / IMPLEMENTED (2026-09-05)

Phase 003 is closed. Implemented, hardened, and manually verified in the running application by the founder.

**Core implementation** (first pass): five tables (`knowledge_sources`, `knowledge_items`, `knowledge_chunks`, `decisions`, `decision_reviews`) with the four-dimension knowledge state model, pgvector semantic retrieval via `match_knowledge_chunks()`, `lib/ai/embeddings.ts` isolated behind the Phase 002 AI boundary, `lib/knowledge/{chunking,retrieval}.ts`, `app/actions/{knowledge,decisions}.ts`, the `/brain` UI (Overview, per-domain browse/create/paste-extract, item detail with verify/archive, Documents, Decisions list/detail/review), and the minimal read-only `askCompanyBrain` Q&A capability. Nine new permissions (`knowledge.*`, `decisions.*`) wired into the existing catalog/RLS pattern with the founder's exact role matrix.

**Hardening pass** (second pass, before closure):
1. **Task sensitivityAllowance enforcement** — `lib/ai/sensitivity.ts`'s `assertClassificationAllowed()` is now called from `lib/ai/router.ts` before any provider-routing decision or network call, so a task alias's `sensitivityAllowance` (model-registry.ts, previously defined but unenforced) and the provider privacy routing rules (`lib/ai/privacy.ts`) are both independently required to pass. Secret is rejected unconditionally at every allowance tier. Live- and unit-verified: a Restricted request against a `public_internal`-only task now fails before OpenRouter is contacted, even though a ZDR-routable provider exists.
2. **Embedding usage/cost tracking** — `lib/ai/embeddings.ts` now records exactly one `ai_usage_events` row per call (success or failure) via the existing `recordUsage()` helper — no new table. Never stores embedded text or raw content. Live-verified with real token/cost metadata, then cleaned up. Also fixed a real data-quality gap found in the process: the embeddings endpoint's `response.model` sometimes omits its provider prefix (unlike chat completions) — added a fallback to the requested model's own prefix, live-confirmed correct.
3. **"+ Add Knowledge" entry point** — a small, permission-gated button added to the `/brain` Overview header (`app/(app)/[companySlug]/brain/page.tsx`) so the empty Brain screen has an obvious path to create knowledge, without redesigning the page.

**Manual browser verification** (completed by the founder, 2026-09-05): manual knowledge creation; AI extraction creating candidate-only knowledge; Founder verification; AI origin correctly attributed after verification (never silently reclassified as human-authored); Company Brain Q&A retrieving source-backed Orextic knowledge; unsupported questions correctly returning "no matching knowledge" rather than an invented answer; source/freshness/verification metadata rendering correctly; cross-company isolation holding (an Orex Studios-only account cannot see Orextic knowledge); a Viewer unable to create, update, or verify knowledge; audit events recorded correctly for all of the above.

**Explicitly deferred, not forgotten:** the Founder "All Companies / Orex Group" Brain scope switcher (RLS/data-model support already exists; UI deferred to a later Founder Command Centre / intelligence phase), advanced chunking (embeddings/overlap tuning beyond the current semantic-structure-first heuristic), duplicate-knowledge detection, and automatic staleness detection.

No application code changed during this closure pass (documentation and status only) — the full test suite from the hardening pass (86/86 unit, 5/5 live integration, typecheck/lint/build clean) remains the current, valid verification record; it was not re-run since nothing it covers changed.

## 1. Objective

Give Orex OS a structured, source-backed memory of what each company (and Orex Group) *is*, *wants*, *does*, *decided*, and *learned* — so that AI answers and human decisions can be grounded in real, attributable company knowledge instead of a model's general training data or an unlabelled guess.

Company Brain is knowledge infrastructure, not a product feature in itself: it is the first thing later phases (Advisor, Risk, Finance, Delivery intelligence) will read from. Phase 003 builds the store, the ingestion path, the retrieval layer, and the smallest defensible UI to populate and browse it — plus one minimal, explicitly read-only Q&A capability to prove the whole pipeline actually works end to end. It does not build the full Founder Advisor, autonomous agents, or any other phase's product surface.

## 2. Existing Foundation (Phase 001 + 002, verified against code — not assumed from docs)

**Phase 001 — organisation/company/permission substrate, all reusable as-is:**
- `organisations`, `companies` (with nullable-safe `organisation_id` scoping already the pattern for group vs. company data), `company_members`, `organisation_members`, `roles`, `permissions`, `role_permissions`, `invitations`, `audit_logs`.
- Server-side authorization: `lib/permissions/index.ts` — `hasPermission(companyId, key)`, `hasOrgPermission(organisationId, key)`, `requirePermission(companyId, key)`, backed by `PERMISSIONS` catalog in `lib/permissions/catalog.ts`.
- RLS pattern: SQL `SECURITY DEFINER` helpers `has_company_permission(company_id, key)`, `has_org_permission(organisation_id, key)`, `is_company_member(company_id)` (migration `0006`), reused directly by every new table below — no new helper functions are needed.
- Founder group access is an explicit `organisation_members` row, resolved through the same functions as everyone else — Company Brain's group-level rows inherit this for free.
- Audit: `lib/audit/index.ts` → `writeAuditLog(event)`, service-role only, append-only (`audit_logs` has no client write policy), redacts secrets via `lib/audit/redaction.ts`.
- Auth: `lib/auth/session.ts` → `requireCurrentUser()`.
- Database clients: `lib/database/server.ts` → `createServerSupabaseClient()` (RLS-enforced) and `createServiceRoleClient()` (server-only, bypasses RLS).
- UI shell: `app/(app)/layout.tsx` (sidebar + `CompanySwitcher`), `app/(app)/[companySlug]/layout.tsx` (slug → company resolution, 404s on forged/inaccessible slugs rather than leaking), dense-table pattern in `components/audit/AuditLogTable.tsx`, form pattern in `components/team/InviteForm.tsx`.

**Phase 002 — AI gateway, all reusable as-is:**
- `lib/ai/gateway.ts` → `requestAI<T>(params)`: the single sanctioned AI entrypoint (auth → alias check → `ai.use` permission check with audit-on-denial → context build → model call → optional Zod-schema validation → usage recording in `finally`).
- `lib/ai/model-registry.ts`: 8 task aliases already defined. `knowledge.extract` is *already reserved specifically for this phase* ("structured fact/entity extraction from documents," per `docs/ai/model-routing.md`) and currently routes to `openai/gpt-5.4-mini`. `advisor.deep` (routes to `anthropic/claude-sonnet-4.6`) is reserved for deep-reasoning/synthesis work.
- `lib/ai/privacy.ts` → `buildProviderPreferences(classification)`: public/internal → no constraint; confidential → deny data collection; restricted → deny + ZDR + require-parameters; secret → hard-throws `PRIVACY_POLICY_REJECTED`. This is exactly the rule Company Brain's classification field must plug into.
- `lib/ai/redaction.ts` / `context-builder.ts`: classify-then-redact pipeline, fails closed on any `"secret"`-classified field. Currently fed synthetic pre-classified fields by test code only — **Phase 003 is the first real caller**, supplying real knowledge-chunk content as classified fields.
- `lib/ai/structured-output.ts` → `validateStructuredOutput(rawContent, schema)`, `toJsonSchemaResponseFormat(name, schema)`: exactly what fact-extraction needs to turn a model response into a typed, validated candidate fact instead of trusting free text.
- `lib/ai/usage.ts` → `recordUsage(event)`: writes to `ai_usage_events` (migration `0011`), no raw prompt/response ever stored.
- No embeddings module, no vector search, no document ingestion code exists anywhere yet. No pgvector extension is enabled. `lib/ai/schemas/index.ts` holds only a test fixture — no real per-task schema exists yet.

**Docs status:** `docs/data-model.md` already anticipates `knowledge_sources/knowledge_documents/knowledge_facts` and `decisions/decision_reviews` as "Future Entities," with the exact separation this phase needs ("verified facts kept structurally separate from AI-generated inference"). `docs/ai/context-policy.md` and `docs/ai/model-routing.md` both explicitly deferred "Company Brain Context" to this phase. `.agents/skills/orex-ai-context-policy/SKILL.md` and `orex-openrouter-gateway/SKILL.md` are fully written and directly reusable; `.agents/skills/orex-company-brain/SKILL.md` is still an unfilled template — **out of scope for this document** (the founder's Phase 003 kickoff instruction asked only for `prompts/003-company-brain.md`; filling the skill file is a separate, smaller follow-up once this spec is approved, noted under Open Questions).

## 3. Current Knowledge State

Zero. No knowledge table, no document, no decision record, no embedding exists anywhere in the codebase or database today. `docs/product-scope.md`'s "Knowledge Layer" section and `docs/data-model.md`'s "Future Entities" are the only prior artifacts, and both are conceptual, not implemented.

## 4. Scope

In scope for Phase 003:
- A relational knowledge store covering all four memory types (Semantic, Episodic, Decision, Procedural) through a small, unified table design (see §7).
- A strict verified-fact / AI-inference / insight-candidate distinction, enforced structurally, not by convention.
- Source attribution on every knowledge item (who/what produced it, when).
- Group-level vs. company-level knowledge, using the existing organisation/company boundary.
- A manual-entry and pasted-text ingestion path (create/edit knowledge directly; paste text and let AI propose candidate facts from it). No file/document upload or storage integration — see §22 Out of Scope.
- pgvector-backed semantic retrieval alongside structured filtering, company/group scoped, permission-checked.
- Decision memory: create a decision, record its context/evidence/options/chosen action, and review it later against what actually happened.
- Knowledge freshness lifecycle: current / stale / superseded / archived, preserving history (no hard deletes of superseded strategic knowledge).
- A real Company Brain UI: browse/create/edit knowledge by domain, view sources and verification state, founder-only "All Companies / Orex Group" scope switch.
- One minimal, explicitly read-only Advisor Q&A capability proving retrieval → AI context → cited answer works, gated behind the same `ai.use` + `knowledge.read` checks as everything else.
- New permissions (`knowledge.*`, `decisions.*`) wired into the existing catalog/RLS pattern, with a proposed default role matrix for founder approval.
- Full audit coverage of knowledge and decision mutations.

## 5. Out of Scope

Explicitly excluded from Phase 003 (per founder's instruction and to avoid overbuilding beyond this slice):
- Full autonomous Founder Advisor product (multi-turn, proactive, cross-domain) — Phase 003 ships one narrow Q&A action only.
- AI Agents of any kind (Daily Operations, Risk, Finance Monitor, etc.).
- Finance Agent, Risk Analysis, Project intelligence, Client intelligence, Meeting intelligence.
- Automatic client profiling.
- Full daily-learning automation (auto-converting operational events into knowledge without a human step) — this phase only lays the conceptual `knowledge_sources.source_type` groundwork for a future daily-log-to-episodic-memory pipeline; it does not build that pipeline.
- Automatic, permanent company-memory updates by AI (every AI-produced item lands as `insight_candidate` or an `is_ai_generated` fact awaiting verification — never auto-verified).
- Builder Studio, agent scheduling.
- Cross-company retrieval without an explicit group-level grant (Founder-only in practice today).
- Autonomous decisions of any kind — `decisions` is a record-keeping structure, not an execution mechanism.
- Document/file upload, storage, or OCR/parsing pipelines (deferred — see §22 note above; ingestion in this phase is manual entry and pasted text only).
- Knowledge-item-to-item relationship graph (`knowledge_relationships`) — deferred; not required for the smallest correct model.
- Separate `insight_candidates` table — folded into `knowledge_items.status`, see §7 rationale.
- A shared `knowledge_documents` vs `knowledge_facts` split — folded into one `knowledge_items` table with an `item_type`, see §7 rationale.
- pgvector index tuning / ANN index type selection beyond a sane default (HNSW) — not a product decision, revisit if retrieval latency becomes a real problem post-launch.

## 6. Knowledge Architecture

```
Author (manual entry, or pasted text) / Operational event (future)
  → knowledge_sources row (who/what produced this, when)
  → knowledge_items row (title, content, domain, classification,
     status: verified_fact | ai_inference | insight_candidate,
     freshness_state, company_id [nullable = group-level])
  → knowledge_chunks (1..N per item; embedding vector per chunk)
  → retrieval layer (lib/knowledge/retrieval.ts):
       permission check → structured filter (domain/company/status)
       + semantic search (pgvector cosine) → source-backed results
  → AI context builder (lib/ai/context-builder.ts, reused):
       classify each retrieved chunk by its knowledge_item's
       classification → redact → privacy-route → gateway.requestAI()
  → typed, cited result (never raw model prose asserted as fact)
```

Decision memory (`decisions` / `decision_reviews`) is a parallel, independently-queryable structure that can optionally reference a `knowledge_items` row (e.g., "this decision produced this lesson"), rather than being modeled as another knowledge item type — decisions have a lifecycle (proposed → decided → reviewed) that doesn't fit the freshness/verification lifecycle of a knowledge fact.

## 7. Memory Types — mapped to the data model

| Memory type | Representation |
|---|---|
| **Semantic** | `knowledge_items` rows with `item_type = 'fact'` or `'document'`, `domain` in (`identity`, `business`, `strategy`, `goals`, `operations`, `sales`, `knowledge`) — vision, mission, services, pricing principles, SOPs, rules, etc. |
| **Episodic** | `knowledge_items` rows with `domain = 'knowledge'` and `knowledge_sources.source_type` pointing at a concrete event (`daily_log`, `meeting`, `project`, `client`, `system_event` — the latter three are placeholders since those tables don't exist yet; see §11). Phase 003 does not auto-generate these; a human records them via manual entry. |
| **Decision** | `decisions` + `decision_reviews` — a dedicated structure, not a `knowledge_items` row (see §6). |
| **Procedural** | `knowledge_items` rows with `domain = 'operations'`, `item_type = 'document'` (SOPs, workflows, delivery processes, QA rules, onboarding, finance procedures as free-text content, optionally chunked for retrieval like any other document). |

No separate table per memory type. All four share the same provenance/classification/verification/freshness machinery; only `domain` and `knowledge_sources.source_type` distinguish them. This is the "smallest correct relational model" the founder's brief asked for — a table per memory type would duplicate every column in §8 four times for no behavioral difference.

## 8. Data Model

**Five new tables**, all following the Phase 001 pattern (`organisation_id`/`company_id` scoping, timestamps, actor columns, RLS via existing helper functions):

### `knowledge_sources`
Records provenance — what produced a piece of knowledge.
```
id                uuid pk
organisation_id   uuid not null references organisations(id)
company_id        uuid null references companies(id)   -- null = group-level source
source_type       text not null check (source_type in (
                    'manual_entry','pasted_text','project','client','meeting',
                    'daily_log','decision','report','system_event',
                    'external_integration'))
source_label      text null   -- human-readable ref, e.g. "Manual entry by founder",
                                since project/client/meeting/daily_log tables
                                don't exist yet — this is a text pointer, not a
                                real FK, until those phases ship (see §11)
created_by        uuid null references auth.users(id)
created_at        timestamptz not null default now()
```
**Why needed:** every knowledge item must be traceable to *something* (AGENTS.md §2.11, §12 Clients "evidence"). A single small table avoids duplicating provenance columns onto `knowledge_items` and `decisions` separately.

### `knowledge_items`
The knowledge unit itself — fact or document, semantic/episodic/procedural.

**Superseded by founder decision #4**: rather than one `status` column, the state is four independent dimensions — `item_type` describes *what kind* of knowledge it is, `origin_type` describes *who/what produced it*, `verification_status` describes *has a human attested it*, and `lifecycle_status` describes *is it still current*. These are orthogonal (e.g. an `ai_extracted` `sop` can be `verified` and `current` all at once) — collapsing them into one column would force an unnatural combined enum.
```
id                  uuid pk
organisation_id     uuid not null references organisations(id)
company_id          uuid null references companies(id)   -- null = Orex Group level
source_id           uuid not null references knowledge_sources(id)
domain              text not null check (domain in (
                      'identity','business','strategy','goals','operations',
                      'sales','knowledge'))
item_type           text not null check (item_type in (
                      'fact','document','vision','mission','goal','service',
                      'strategy','rule','policy','process','sop','lesson',
                      'win','failure','research'))
origin_type         text not null check (origin_type in (
                      'human','ai_extracted','system'))
verification_status text not null check (verification_status in (
                      'candidate','verified','rejected'))
                    default 'candidate'
lifecycle_status    text not null check (lifecycle_status in (
                      'current','stale','superseded','archived'))
                    default 'current'
title               text not null
content             text not null
classification      text not null check (classification in (
                      'public','internal','confidential','restricted','secret'))
                    default 'internal'
superseded_by       uuid null references knowledge_items(id)
confidence          numeric(4,3) null check (confidence between 0 and 1)
                    -- only meaningful for origin_type = 'ai_extracted'
created_by          uuid null references auth.users(id)
verified_by         uuid null references auth.users(id)
verified_at         timestamptz null
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()

-- Enforced in the server action (not a CHECK constraint, since it spans two
-- columns' state-transition history, not just their current values):
-- a row may never be inserted with origin_type = 'ai_extracted' AND
-- verification_status = 'verified' -- AI output always lands as 'candidate'.
```
**Why needed:** this is the core store. The `origin_type`/`verification_status` pair is the structural verified-fact/AI-inference/insight-candidate separation the founder required — first-class columns, not a tag buried in free text, so "verified company knowledge" is `where verification_status = 'verified'`, full stop, and "did a human write this" is `where origin_type = 'human'`, independently queryable. `confidence` exists only for `ai_extracted` rows so a UI can show "AI: 78% confident" without ever attaching a false confidence number to something a human verified. `superseded_by` plus `lifecycle_status = 'superseded'` implements "preserve history, never delete."

**Why NOT separate `knowledge_documents` and `knowledge_facts` tables:** both need identical provenance/classification/verification/freshness columns; the only real difference is whether `content` is a short factual statement or a longer document body, which `item_type` already captures. Two tables would mean duplicating the RLS policies, the audit event wiring, and every query that doesn't care about the distinction (e.g. "give me everything current and verified for company X").

**Why NOT a separate `insight_candidates` table:** an insight candidate is a `knowledge_items` row with `status = 'insight_candidate'` — the founder's requirement ("must not silently become permanent company knowledge") is enforced by requiring an explicit, audited `status` transition (`insight_candidate` → `verified_fact`, always by a human with `knowledge.verify`) rather than by physically moving a row between tables. A separate table would need the exact same columns and would just add a migration step (copy row, delete original) to something that should be a single `UPDATE`.

### `knowledge_chunks`
Retrieval unit — one or more per `knowledge_items` row.
```
id                  uuid pk
knowledge_item_id   uuid not null references knowledge_items(id) on delete cascade
chunk_index         int not null
content             text not null
embedding           vector(N)  -- N = chosen embedding dimension, see §9 (open question)
created_at          timestamptz not null default now()
unique (knowledge_item_id, chunk_index)
```
**Why needed, and why not just an `embedding` column on `knowledge_items` directly:** a short fact is one chunk (chunk 0 = the fact text itself), but a longer document (an SOP, a strategy write-up) must be split for embedding quality and to let retrieval return the *specific paragraph* that's relevant with a pointer back to its parent item — not the whole document as one opaque vector. Every `knowledge_items` row still gets ≥1 chunk, so retrieval code has one code path regardless of `item_type`.

**Why NOT a separate `knowledge_embeddings` table:** the vector is 1:1 with a chunk's content; splitting them into two tables would only add a join with no isolation or lifecycle benefit (deleting/archiving the source item cascades to its chunks either way).

### `decisions`
```
id                  uuid pk
organisation_id     uuid not null references organisations(id)
company_id          uuid null references companies(id)   -- null = group-level decision
title               text not null
owner_id            uuid not null references auth.users(id)
status              text not null check (status in (
                      'proposed','decided','in_review','closed'))
                    default 'proposed'
situation           text not null
evidence            jsonb not null default '[]'::jsonb
options             jsonb not null default '[]'::jsonb
ai_recommendation   text null   -- always AI-labelled when rendered; never
                                  auto-copied into chosen_action
chosen_action       text null
expected_result     text null
decision_date       date null
review_date         date null
related_knowledge_item_id uuid null references knowledge_items(id)
created_by          uuid null references auth.users(id)
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
```

### `decision_reviews`
```
id                  uuid pk
decision_id         uuid not null references decisions(id) on delete cascade
reviewed_by         uuid not null references auth.users(id)
review_date         date not null default current_date
actual_result       text not null
lesson              text null
created_at          timestamptz not null default now()
```
**Why a separate reviews table instead of `actual_result`/`lesson` columns on `decisions` itself:** the founder's brief explicitly frames this as "Orex OS later asks: what happened after this decision?" — a decision can reasonably be reviewed more than once (a 90-day check-in, then a 1-year retrospective), and a single mutable pair of columns would overwrite the earlier review's finding. `decision.reviewed` is also a distinct audit event from `decision.updated`, which a separate table makes natural to log.

**Not proposed:** `knowledge_relationships` (no concrete cross-item query needs it yet — deferred), a separate `knowledge_embeddings` table (folded into `knowledge_chunks`), a separate `insight_candidates` table (folded into `knowledge_items.status`).

## 9. Source Model

`knowledge_sources.source_type` enumerates: `manual_entry`, `pasted_text`, `project`, `client`, `meeting`, `daily_log`, `decision`, `report`, `system_event`, `external_integration`. Only `manual_entry` and `pasted_text` are actually reachable from Phase 003 UI (see §5 Out of Scope) — the rest are seeded into the check constraint now so future phases (Projects, Clients, Calendar, Daily Log) can attach real knowledge without a migration, exactly like Phase 001 pre-seeded `finance.*`/`clients.*` permissions ahead of their modules. `source_label` is a free-text pointer rather than a real foreign key because the target tables (`projects`, `clients`, `meetings`, `daily_logs`) don't exist yet; once they do, a future migration should add proper nullable FK columns alongside `source_label` rather than trying to guess their shape now.

## 10. Facts and Inference Model

Three states, one column (`knowledge_items.status`), enforced by workflow not just convention:
- **`verified_fact`** — a human with `knowledge.verify` has attested this is accurate. Requires `verified_by` + `verified_at` to be set (enforced in the server action, not just the UI).
- **`ai_inference`** — produced by `knowledge.extract` fact-extraction from pasted text or by `advisor.deep` synthesis; always carries `confidence`; always rendered in the UI with a visible "AI-generated" label; never silently treated as equivalent to a verified fact by retrieval ranking (verified facts are preferred, see §13).
- **`insight_candidate`** — the default landing state for anything not yet reviewed by a human, whether AI-produced or a quick manual note. Promotion to `verified_fact` is a distinct, audited (`knowledge.verified`) action requiring `knowledge.verify`, never automatic.

A verified fact can be superseded (new row, `freshness_state = 'current'`; old row updated to `freshness_state = 'superseded'`, `superseded_by` set) but is never silently overwritten in place — this satisfies "a verified company fact must never be silently replaced by an AI assumption" structurally: an AI-produced row can never carry `status = 'verified_fact'` on creation (the server action that inserts AI-extracted candidates always writes `status = 'insight_candidate'`, full stop, regardless of confidence).

## 11. Knowledge Ingestion

```
Author action (manual entry form, or "paste text" form)
  → auth + requirePermission(companyId ?? null, 'knowledge.create')
  → content normalization (trim, strip control chars)
  → classification (author-selected from the 5-level enum; defaults to 'internal')
  → [pasted-text path only] knowledge.extract AI call:
       gateway.requestAI({alias: 'knowledge.extract', schema: candidateFactSchema, ...})
       → zero or more candidate knowledge_items, status='insight_candidate',
         each confidence-scored, each chunked+embedded
  → [manual-entry path] one knowledge_items row, status is author-selectable
       between 'insight_candidate' and 'verified_fact' (a founder/director typing
       in "our mission is X" directly can mark it verified immediately — requires
       knowledge.verify, not knowledge.create, to do so)
  → knowledge_sources row created/linked
  → chunking (documents split on paragraph boundaries, ~500-token target chunks;
    facts are always exactly one chunk)
  → embedding generation (via the approved AI boundary — see §12 open question)
  → knowledge_chunks rows written
  → row becomes retrievable (no separate "publish" step — retrieval already
    filters by status/freshness/permission, so an unverified insight_candidate
    is retrievable but visibly labelled, per §13)
```

Not every pasted document produces a permanently retrievable structured fact automatically verified — every AI-extracted item lands as `insight_candidate` and requires a human `knowledge.verify` action to become load-bearing company knowledge, per AGENTS.md §2.14 and §10.1.

## 12. Chunking

Facts (`item_type = 'fact'`): always 1 chunk (`chunk_index = 0`, `content = knowledge_items.content` verbatim) — no real splitting logic needed, kept for schema uniformity so retrieval always queries `knowledge_chunks`.

Documents (`item_type = 'document'`): split on paragraph/section boundaries targeting ~500 tokens per chunk with no overlap in the initial version (overlap is a retrieval-quality tuning knob, not a Phase 003 architectural decision — can be added later without a schema change). Chunking runs synchronously in the same server action as ingestion (documents are expected to be short pasted text, not large files, per the Out of Scope decision to defer file upload) — no background job/queue is introduced in this phase.

## 13. Embeddings

pgvector, via Supabase's built-in `vector` extension (`create extension if not exists vector;` — a new migration, must run before `knowledge_chunks` is created). One `vector(N)` column on `knowledge_chunks.embedding`. An HNSW index (`USING hnsw (embedding vector_cosine_ops)`) is added for approximate nearest-neighbor search — Postgres/pgvector's standard default, not a bespoke tuning decision.

Embedding generation must go through the same AI-boundary discipline as chat completions: classification-gated (never embed `secret`-classified content — enforced identically to `lib/ai/privacy.ts`'s hard-throw), and never sent to a provider without the same data-collection/ZDR posture Phase 002 already defines for confidential/restricted content. **Concretely, this needs one new small module, `lib/ai/embeddings.ts`, following the exact isolation pattern of `lib/ai/client.ts`** — whether that module calls OpenRouter's embeddings endpoint (if the installed `@openrouter/sdk` version exposes one) or a direct provider is an **open question requiring a founder decision before implementation** (§28) — the specification deliberately does not hard-code this, per the founder's own instruction not to assume an embedding architecture before checking the actual provider strategy. Retrieval ranking always prefers `status = 'verified_fact'` rows over `ai_inference`/`insight_candidate` rows at equal similarity (a tie-break boost, not a hard filter — an unverified candidate can still surface, clearly labelled, if nothing verified matches).

Vector dimension `N` is fixed by whichever embedding model is approved (§28) — e.g. 1536 for `text-embedding-3-small`-class models. This must be decided before the `knowledge_chunks` migration is written, since `vector(N)` is a fixed-width Postgres column type.

## 14. Retrieval

New module `lib/knowledge/retrieval.ts` (mirrors `lib/ai/*`'s isolation discipline — this is the only module allowed to run the `knowledge_chunks` embedding similarity query):

```
retrieveKnowledge({ companyId, organisationId, domain?, statusFilter?, query, limit })
  → requireCurrentUser()
  → requirePermission(companyId ?? null, 'knowledge.read')   -- company-level,
       or hasOrgPermission(organisationId, 'knowledge.read') for company_id = null rows
  → structured filter (domain, status, freshness_state != 'archived' by default)
  → semantic search: embed(query) via lib/ai/embeddings.ts, cosine similarity
       against knowledge_chunks.embedding, joined back to knowledge_items
       (RLS on knowledge_items/knowledge_chunks enforces company/group
       scoping at the database layer regardless of what the caller passes in)
  → returns: [{ content, domain, itemType, status, source, companyId,
       freshnessState, similarity, confidence? }]
```

This is the reusable layer that both the Company Brain UI's search box and the Advisor Q&A capability (§17) call — one retrieval implementation, two consumers. Results are never unfiltered raw rows: every result carries its verification state and source so a UI or an AI context builder can decide how to present or weight it, per AGENTS.md §2.13 ("separate personal reflection from evidence-based intelligence") applied here as "separate verified fact from inference in every surface, not just storage."

## 15. Decision Memory

Covered in §8 (`decisions`/`decision_reviews`). Server actions: `createDecision`, `updateDecision` (status transitions `proposed → decided → in_review → closed`), `reviewDecision` (inserts a `decision_reviews` row, does not overwrite prior reviews). No automatic decision scoring or AI-driven status changes — `ai_recommendation` is a free-text field an author can optionally populate (e.g., by pasting output from an `advisor.deep` call made elsewhere), never a field the gateway writes to directly in this phase.

## 16. Knowledge Freshness

`freshness_state`: `current` (default) → `stale` (manually flagged, e.g. by a scheduled reminder a human dismisses/confirms — no automated staleness job in this phase) → `superseded` (a newer `knowledge_items` row exists via `superseded_by`) → `archived` (explicitly retired, excluded from default retrieval and default UI views, still queryable with an explicit filter, never deleted). All four states are UI-visible with distinct treatment (e.g., archived items shown greyed out in a separate tab, never silently hidden with no trace). No hard deletes of any `knowledge_items` row are exposed anywhere in this phase — "archive" is the only destructive-feeling action, and it is reversible (unarchiving is just another `knowledge.update`).

## 17. First Advisor Capability (minimal, read-only)

One new server action, `askCompanyBrain({ companyId, organisationId, question })`:
```
requireCurrentUser() → requirePermission(companyId, 'knowledge.read') AND
  requirePermission(companyId, 'ai.use')  -- both checks; ai.use alone is
  not sufficient, per founder's explicit instruction that AI permission
  never substitutes for data permission
→ retrieveKnowledge({ ..., query: question, limit: 8 })
→ gateway.requestAI({
     alias: 'advisor.deep',
     context: { fields: retrievedChunks.map(toClassifiedField) },
     schema: advisorAnswerSchema,   -- { answer: string, citedSources:
                                        Array<{ knowledgeItemId, title }> }
     ...
  })
→ returns typed, cited answer — UI renders the answer with its source
   list, never as unattributed prose
```
Read-only: this action never writes to `knowledge_items`, `decisions`, or any other business table. It is a thin composition of two already-approved primitives (retrieval + gateway), not a new AI capability class, which is why it's includable in this phase without expanding the AI-action-policy surface (`docs/ai/ai-action-policy.md` governs *mutations*; this performs none). If the founder prefers to defer even this minimal capability to Phase 007 (Intelligence), it can be cut entirely from the implementation without touching any other part of this spec — flagged as Open Question §28.

## 18. Company/Group Scoping

Identical pattern to Phase 001: `company_id` non-null → company-scoped row, visible only to members of that company (or an org-level grant covering it). `company_id` null → group-level (Orex Group) row, visible to org-level grant holders only (in practice, the founder). No new scoping mechanism is introduced — this is the same nullable-company-id pattern `docs/data-model.md` already anticipated for these exact tables. A normal company-scoped user never sees another company's `knowledge_items`/`decisions` rows, enforced at the RLS layer independent of what the application code queries for.

## 19. Permissions

Nine new keys added to the existing catalog (migration required — `permissions` is seeded data, not a dynamic table):
```
knowledge.read
knowledge.create
knowledge.update
knowledge.verify
knowledge.manage

decisions.read
decisions.create
decisions.update
decisions.review
```

**Founder-approved role matrix** (supersedes this document's originally-proposed matrix):

| Permission | Founder | Director | Manager | Finance | Project Mgr | Creative Lead | Member | Contractor | Viewer |
|---|---|---|---|---|---|---|---|---|---|
| knowledge.read | ● | ● | ● | | ● | ● | ● | (scoped) | ● |
| knowledge.create | ● | ● | ● | | ● | ● | | | |
| knowledge.update | ● | ● | ● | | ● | ● | | | |
| knowledge.verify | ● | ● | | | | | | | |
| knowledge.manage | ● | ● | | | | | | | |
| decisions.read | ● | ● | ● | | ● | ● | ● | (scoped) | ● |
| decisions.create | ● | ● | ● | | ● | ● | | | |
| decisions.update | ● | ● | ● | | | | | | |
| decisions.review | ● | ● | ● | | | | | | |

Contractor's `knowledge.read`/`decisions.read` are marked "(scoped)" — granted at the row level only where company/resource access already permits, matching the existing Contractor design intent in `docs/permissions.md` (no blanket grant; enforced the same way Contractor's `projects.read` is scoped today). Finance does not receive any Company Brain permission in this phase (not requested by the founder's matrix) — revisit when the Finance module ships if finance-specific knowledge domains emerge. `knowledge.verify`/`knowledge.manage`/`decisions.review` remain Founder/Director-only high-trust actions, per the founder's explicit instruction that Member/Contractor/Viewer must never verify company truth.

`ai.use` remains necessary but not sufficient for `askCompanyBrain` — both it and `knowledge.read` are checked, per the founder's explicit instruction in this phase's brief ("Do not use `ai.use` as a replacement for knowledge authorization").

## 20. RLS

Every new table gets RLS enabled, default deny, explicit policies using the existing helper functions — no new SQL functions needed:

```sql
-- knowledge_items SELECT example
create policy knowledge_items_select on knowledge_items for select
  using (
    (company_id is not null and has_company_permission(company_id, 'knowledge.read'))
    or (company_id is null and has_org_permission(organisation_id, 'knowledge.read'))
  );
```
Same shape for INSERT (`knowledge.create`), UPDATE (`knowledge.update` for content edits; a separate policy path is not needed for verification since `knowledge.verify` is enforced in the server action before the UPDATE is issued — RLS still requires `knowledge.update` at minimum as a floor). `knowledge_sources` and `knowledge_chunks` have no direct client SELECT policy of their own beyond what's needed for the app to join through `knowledge_items` — they inherit access transitively by always being queried joined to a `knowledge_items` row the caller can already see; `knowledge_chunks`/`knowledge_sources` get a narrow SELECT policy mirroring the same `has_company_permission`/`has_org_permission` check via a join back to their parent, so a forged direct query against `knowledge_chunks` can't bypass the parent's scoping. `decisions`/`decision_reviews` follow the identical pattern keyed to `decisions.*` permissions, with `decision_reviews` policies joining back to `decisions.company_id`/`organisation_id`.

No client-facing INSERT/UPDATE/DELETE policy is granted for AI-authored writes — every AI-extraction write path goes through a server action using `createServiceRoleClient()` after the same permission checks as a human-authored write, exactly like `lib/audit`/`lib/ai/usage.ts` do today. RLS is the backstop; the server action is the actual gate.

## 21. AI Integration

- `knowledge.extract` alias: fact-candidate extraction from pasted text, structured output via `candidateFactSchema` (new, in `lib/ai/schemas/knowledge.ts`).
- `advisor.deep` alias: the minimal Q&A capability (§17), structured output via `advisorAnswerSchema`.
- Both go through the unmodified `lib/ai/gateway.ts` — no gateway code changes required, only new schemas and two new call sites.
- New: `lib/ai/embeddings.ts` (§13) — the only module allowed to generate embeddings, isolated the same way `lib/ai/client.ts` isolates chat completions.
- Context assembly for both capabilities reuses `lib/ai/context-builder.ts`/`redaction.ts` unmodified — Phase 003 supplies real classified fields (from `knowledge_items.classification`) for the first time; no changes to that module's logic are anticipated, only real callers.
- AI is never given write access to `knowledge_items`/`decisions` directly — every AI output lands in application code first (as a candidate, as an answer payload), and a human-gated server action decides whether/how it becomes a database row.

## 22. UI Requirements

New route: `app/(app)/[companySlug]/brain/`. Sub-views (tabs, not separate top-level nav items, to keep the sidebar from sprawling):
- **Overview** — counts by domain/status, recently updated, recently verified.
- **Identity / Strategy / Goals / Services / Rules / Processes** — each a filtered `domain` view over `knowledge_items`, dense table (title, status badge, freshness badge, source, last updated) reusing `AuditLogTable`'s table styling conventions.
- **Decisions** — list + detail view of `decisions`, with an inline review-history panel from `decision_reviews`.
- **Documents** — `item_type = 'document'` items, i.e. longer-form procedural/strategic text.
- Every knowledge item's detail view shows: content, domain, classification, status (with clear "AI-generated — unverified" styling for non-verified rows), source, freshness state, verified-by/at if applicable, and a "verify" action gated on `knowledge.verify`.
- Company scope switcher: for a founder viewing via an org-level grant, an "All Companies / Orex Group / Orextic / Orex Studios" selector at the top of `/brain` (new, company-brain-specific — not a change to the existing `CompanySwitcher` used for company-scoped pages elsewhere in the app). Non-founder users viewing their own company's `/brain` never see this control, matching existing sidebar-visibility-is-not-security discipline (server/RLS enforce regardless).
- "Ask" box on the Overview tab wired to `askCompanyBrain` (§17), rendering the answer with a visible source list — not a chat thread, a single question/single answer interaction, deliberately small.
- Empty/loading/error states for every new view, per AGENTS.md §16 and the existing `AuditLogTable` "No audit events yet." convention.
- No new design tokens — reuses `--surface`/`--border`/`--muted`/`--accent`/status colors already in `app/globals.css`. Status badges reuse the same color-by-meaning convention as `AuditLogTable`'s result-status coloring (verified/current = success green, insight_candidate/stale = warning amber, superseded/archived = muted grey).

## 23. Audit Requirements

New audit actions, all written via the existing `writeAuditLog()`:
```
knowledge.created
knowledge.updated
knowledge.verified
knowledge.superseded
knowledge.archived

decision.created
decision.updated
decision.reviewed
```
`before_state`/`after_state` capture the relevant `knowledge_items`/`decisions` row diff (redacted via the existing `redactSecrets` pass, though these tables should never contain secret-pattern keys by design — classification, not key-name pattern, is the primary control here). `audit_logs` itself is never used as a knowledge store — it records that a change happened, not the substance of company knowledge (the founder's explicit instruction).

## 24. Files Expected to Change

- `lib/permissions/catalog.ts` — add 9 new `PERMISSIONS` keys.
- `docs/permissions.md` — document the new keys and matrix (kept in sync per AGENTS.md §21.10).
- `docs/data-model.md` — move `knowledge_sources/knowledge_items/knowledge_chunks/decisions/decision_reviews` from "Future Entities" to the implemented section.
- `docs/ai/context-policy.md` — remove the "Company Brain — not applicable in Phase 002" caveat, replace with a real description of the first live caller.
- `docs/ai/model-routing.md` — note `knowledge.extract` and `advisor.deep` now have real callers.
- `AGENTS.md` — no change anticipated (Company Brain is already named as a core module in §12; nothing about the phase changes a permanent project rule).

## 25. Files Expected to Be Created

```
supabase/migrations/0012_enable_pgvector.sql
supabase/migrations/0013_knowledge_and_decisions.sql   -- tables + RLS + indexes
supabase/migrations/0014_knowledge_permissions.sql     -- catalog + role_permissions seed

lib/knowledge/
  retrieval.ts
  retrieval.test.ts
  chunking.ts
  chunking.test.ts
  types.ts

lib/ai/embeddings.ts
lib/ai/embeddings.test.ts
lib/ai/schemas/knowledge.ts        -- candidateFactSchema, advisorAnswerSchema

app/actions/knowledge.ts           -- createKnowledgeItem, updateKnowledgeItem,
                                       verifyKnowledgeItem, supersedeKnowledgeItem,
                                       archiveKnowledgeItem, extractCandidatesFromText,
                                       askCompanyBrain
app/actions/decisions.ts           -- createDecision, updateDecision, reviewDecision

app/(app)/[companySlug]/brain/
  page.tsx                          -- Overview
  layout.tsx                        -- tab shell + scope switcher
  [domain]/page.tsx                 -- Identity/Strategy/Goals/Services/Rules/Processes
  decisions/page.tsx
  decisions/[id]/page.tsx
  documents/page.tsx
  [id]/page.tsx                     -- knowledge item detail

components/knowledge/
  KnowledgeTable.tsx
  KnowledgeDetail.tsx
  KnowledgeStatusBadge.tsx
  KnowledgeFreshnessBadge.tsx
  KnowledgeForm.tsx
  PasteTextIngestForm.tsx
  CompanyBrainScopeSwitcher.tsx
  AskCompanyBrainBox.tsx

components/decisions/
  DecisionTable.tsx
  DecisionDetail.tsx
  DecisionForm.tsx
  DecisionReviewForm.tsx
```

## 26. Database Migrations

Three migrations, in order:
1. `0012_enable_pgvector.sql` — `create extension if not exists vector;` (isolated so a failure/permission issue here doesn't block the table migration from being reviewed independently).
2. `0013_knowledge_and_decisions.sql` — the five tables from §8, all RLS policies from §20, the HNSW index on `knowledge_chunks.embedding`, standard btree indexes on `company_id`/`organisation_id`/`domain`/`status`/`freshness_state` for `knowledge_items` and on `decision_id` for `decision_reviews`.
3. `0014_knowledge_permissions.sql` — seeds the 9 new `permissions` rows and the `role_permissions` matrix from §19.

Applied to the same live Supabase project used for Phases 001/002, using `mcp__claude_ai_Supabase__apply_migration` exactly as prior phases were applied, verified via `list_tables`/`get_advisors` afterward.

## 27. Security Requirements

- Company/group isolation enforced by RLS, not application filtering (§20) — matches Phase 001/002 pattern exactly, no new trust boundary introduced.
- `secret`-classified content can never enter `knowledge_chunks.embedding` generation nor any `gateway.requestAI()` context — enforced by the same fail-closed check `lib/ai/privacy.ts`/`context-builder.ts` already implement, applied to real classified content for the first time.
- `confidential`/`restricted` knowledge follows the exact Phase 002 provider-routing rules (deny data collection; restricted additionally requires ZDR + require-parameters) — no new privacy tier is introduced for knowledge specifically.
- AI-authored writes only via server-side service-role paths with the same permission checks as human writes (§20) — no client-side path can insert a row claiming to be AI-verified.
- No hard deletes exposed in the UI or server actions for `knowledge_items` (archive only) — preserves the audit trail and prevents "delete inconvenient history" as an available action for any role, including founder, without a direct database operation outside the application.
- Every mutation audited per §23, with actor, before/after state, and timestamp — no exceptions for AI-originated writes (they carry `actor_type = 'ai_agent'` plus the initiating human's `actor_user_id` where the action was human-triggered, e.g. "paste text" being an AI-assisted human action, not an autonomous one).

## 28. Acceptance Criteria

1. A user with `knowledge.create` in Company A can create a knowledge item; a user in Company B cannot see it via any UI path or direct API/RPC call.
2. A verified fact (`status = 'verified_fact'`) can only be created/promoted by a user holding `knowledge.verify`; a `knowledge.create`-only user's attempt to set `status = 'verified_fact'` directly is rejected server-side regardless of what the client sends.
3. Pasting text through the ingestion form produces one or more `insight_candidate` rows with populated `confidence`, never `verified_fact` rows, regardless of how confident the model claims to be.
4. `askCompanyBrain` returns an answer with a non-empty cited-source list drawn only from knowledge the requesting user could independently retrieve via `knowledge.read`; a Restricted-classified fact is only cited if the caller's classification allowance permits it.
5. A `secret`-classified `knowledge_items` row (if one is ever created — no UI path should normally allow classification='secret' for something meant to be searchable, but the constraint doesn't forbid it, so the pipeline must handle it safely) is never embedded and never appears in any `gateway.requestAI()` context; attempting to include it fails closed with `PRIVACY_POLICY_REJECTED`/`CONTEXT_CONSTRUCTION_FAILED`, not silently dropped-and-succeeded.
6. Archiving a knowledge item removes it from default retrieval/UI views but the row and its full history remain queryable; no row is ever physically deleted by any Phase 003 code path.
7. A decision's `decision_reviews` history accumulates (multiple reviews over time are all preserved, not overwritten).
8. Founder viewing via an org-level grant can see Orex Group-level knowledge and both companies' knowledge through the scope switcher; a company-scoped Director cannot see the other company's knowledge or Orex Group-level knowledge unless separately granted.
9. All 9 new permission keys appear in `docs/permissions.md`'s matrix and are enforced identically in RLS and server-side checks (no divergence).
10. Full Phase 001 and Phase 002 test suites continue to pass unmodified.

## 29. Automated Tests

- `lib/knowledge/retrieval.test.ts` — permission denial, company isolation, group-scope resolution, status/freshness filtering, similarity ranking with verified-fact tie-break.
- `lib/knowledge/chunking.test.ts` — fact → 1 chunk; document → N chunks; chunk boundaries don't split mid-sentence pathologically (basic sanity, not NLP-grade).
- `lib/ai/embeddings.test.ts` — classification gate (secret rejected), mocked provider call, dimension-shape assertion.
- `app/actions/knowledge.test.ts` (or colocated) — status-transition enforcement (`knowledge.verify` required to reach `verified_fact`), audit-write-on-mutation, supersede/archive freshness transitions.
- `app/actions/decisions.test.ts` — decision lifecycle transitions, review accumulation, audit-write-on-mutation.
- Extend `lib/ai/gateway.test.ts` coverage (or a new test) confirming `knowledge.extract`/`advisor.deep` real schema validation round-trips (mocked router, real Zod schemas from `lib/ai/schemas/knowledge.ts`).
- RLS policy tests (live Supabase, same impersonation technique used in Phase 001/002 verification): cross-company denial on `knowledge_items`/`knowledge_chunks`/`decisions`/`decision_reviews`; founder group access; Viewer cannot mutate.

## 30. Manual Tests

1. Sign in as a company-scoped (non-founder) user in Orextic; confirm Orex Studios knowledge is invisible everywhere (`/brain` UI, and a direct forged-id fetch attempt).
2. Sign in as founder; confirm the "All Companies / Orex Group / Orextic / Orex Studios" switcher appears and each scope shows the correct rows.
3. Create a knowledge item as a Viewer-equivalent role; confirm no create UI is exposed and a direct server-action call (if attempted) is rejected.
4. Paste a short SOP-like text block; confirm candidate facts appear as `insight_candidate` with visible AI labelling and confidence, and are not retrievable as "verified" anywhere in the UI until explicitly verified.
5. Verify a candidate as Director; confirm status flips to `verified_fact`, `verified_by`/`verified_at` populate, and an audit log entry appears.
6. Supersede a verified fact with a new one; confirm the old row is still visible under "superseded," not gone.
7. Archive an item; confirm it disappears from default views but remains visible with an explicit "show archived" toggle.
8. Ask a question via the Ask box; confirm the answer cites real sources and that a question with no relevant knowledge returns an honest "no matching company knowledge found" rather than a fabricated answer.
9. Attempt to classify a knowledge item as `secret` and ask a question that would need it; confirm the pipeline fails safely rather than leaking it.
10. Create and review a decision; confirm a second review later doesn't erase the first.

## 31. Regression Tests

- Re-run full Phase 001 suite (org/company/membership/role/permission/invitation/audit) — must remain 100% passing, no table/policy touched outside the five new ones.
- Re-run full Phase 002 suite (unit + live integration) — `lib/ai/gateway.ts`/`router.ts`/`privacy.ts`/`redaction.ts`/`errors.ts` must be unmodified; only new callers and one new sibling module (`embeddings.ts`) are added.
- Re-run the browser-bundle secret scan — no embedding-provider key (whatever §28's decision picks) may appear in `.next/static`, exactly like the `OPENROUTER_API_KEY` check.
- Re-verify RLS on `ai_usage_events` (Phase 002) is untouched by the new migrations.

## 32. Rollback Plan

Each migration is additive only (new tables, new extension, new seeded rows) — no existing table is altered. Rollback is three reverse migrations: drop the three new tables' RLS policies and tables (`0013` reverse), delete the seeded `permissions`/`role_permissions` rows scoped to the 9 new keys (`0014` reverse), and optionally `drop extension vector` (`0012` reverse, only if no other feature has since depended on it — unlikely to be safe to assume in a later phase, so this step should be treated as effectively one-way in practice once Phase 004+ ships). No Phase 001/002 table or function is touched, so no rollback risk to existing functionality exists independent of this phase's own tables.

## 33. Risks

1. **Embedding provider/model is undecided** (§28) — this is the single largest open item; guessing wrong means a `vector(N)` dimension migration rewrite later. Flagged, not resolved, in this document by design.
2. **Chunking quality is basic** (paragraph-boundary splitting, no overlap) — acceptable for the smallest correct version, but retrieval quality on long documents may be mediocre until a future tuning pass.
3. **No file upload** means real-world adoption (people have documents, not just things they're willing to retype) may be slower than the founder expects — explicitly deferred, not forgotten; should be called out plainly when this spec is presented.
4. **Confidence-score reliability** is only as good as the underlying model's self-reported calibration — `confidence` is stored and shown, but nothing in this phase validates it against ground truth (no evaluation harness exists yet per `docs/ai/evaluation-plan.md`).
5. **Freshness/staleness has no automated trigger** — a `current` item can silently become outdated with no reminder mechanism in this phase; purely a manual human responsibility for now.

## 34. Open Questions

1. **Embedding provider and model** — does the installed `@openrouter/sdk` (v1.2.106) expose an embeddings endpoint, or does Phase 003 need a separate direct-provider integration (e.g., OpenAI's embeddings API) isolated behind `lib/ai/embeddings.ts` the same way `client.ts` isolates OpenRouter? This determines `vector(N)`'s dimension and must be resolved before `0013_knowledge_and_decisions.sql` can be finalized. **Recommendation:** confirm SDK embeddings support first; if absent, use a direct provider call (still classification-gated and privacy-routed identically) rather than blocking the whole phase on OpenRouter adding the capability.
2. **Should the minimal `askCompanyBrain` Q&A capability (§17) ship in Phase 003 at all**, or is it cleaner to hold it for Phase 007 (Intelligence) once more knowledge domains exist to make an answer meaningful? This spec includes it as a small, cheap proof that ingestion→retrieval→AI-context actually works end to end, but it is the one piece of this phase that is a "capability" rather than pure "infrastructure," so it's the most natural thing to cut if the founder wants a stricter infrastructure-only phase.
3. **Proposed permission role matrix (§19)** — presented as a reasonable default mirroring existing patterns; needs explicit founder confirmation or adjustment, same as Phase 001's matrix required.
4. **`.agents/skills/orex-company-brain/SKILL.md` remains an unfilled template.** It wasn't in scope for this document (the founder's kickoff instruction named only `prompts/003-company-brain.md`), but implementers will want it filled in alongside `/implement` — confirm whether to write it as a fast follow-up before implementation starts, or fold it into the same approval gate as this document.
5. **Chunk overlap and target chunk size** (§12) — proposed defaults (paragraph-boundary, ~500 tokens, no overlap) are reasonable starting points, not founder-validated; flagging in case there's a strong existing preference.

## 35. Implementation Instructions

Do not begin implementation until this document's Status changes to APPROVED and Open Questions §34 are explicitly resolved by the founder (particularly #1, which blocks the schema, and #2, which changes the file list). Once approved: implement in the order §26 lists the migrations (pgvector extension → tables/RLS → permissions), then `lib/ai/embeddings.ts`, then `lib/knowledge/*`, then server actions, then UI, running `npm run typecheck`/`lint`/`test`/`build` after each major slice rather than only at the end — matching the incremental verification discipline used in Phase 002. Full Phase 001 + Phase 002 regression checks (§31) are required before this phase can be reported as ready to close, exactly as Phase 002's closure required a Phase 001 regression pass.

Then stop.
