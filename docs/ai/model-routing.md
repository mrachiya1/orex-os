# Orex OS Model Routing

## Principles

Feature code requests a **task alias** describing what it needs (a capability + constraints), never a specific provider model id. The alias-to-model mapping is configuration, stored in one registry, changeable without touching any feature code. This is what lets Orex OS swap models — or even swap providers — as better options appear, without a rewrite.

## Task Aliases

For every alias: purpose, reasoning requirement, latency class, cost class, structured-output requirement, tool requirement, context-size requirement, sensitivity allowance, and primary/fallback model **concepts** (not permanent commitments — see each table row's "PROPOSED" marker).

| Alias | Purpose | Reasoning | Latency | Cost | Structured output | Tools | Context size | Sensitivity allowance |
|---|---|---|---|---|---|---|---|---|
| `advisor.deep` | Founder/Advisor Chat deep analysis and recommendations | High | Relaxed (seconds) | Higher | Yes (recommendation schema) | Future | Large | Internal + Confidential (permission-gated) |
| `ops.fast` | Quick operational summaries, today-dashboard style text | Low | Fast (sub-second to ~1s) | Low | Light (short text or small schema) | No | Small | Internal |
| `finance.structured` | Structured extraction/summary over financial data | Medium | Relaxed | Medium | Yes (strict schema) | No | Medium | Restricted (permission-gated: `finance.read`) |
| `risk.deep` | Risk analysis and scoring | High | Relaxed | Higher | Yes (risk schema) | No | Medium-large | Confidential/Restricted (permission-gated) |
| `meeting.research` | Pre-meeting brief research/summarization | Medium | Relaxed | Medium | Yes (brief schema) | Future (calendar/CRM lookups) | Medium | Internal + Confidential |
| `builder.long` | Long-form document generation (proposals, reports, case studies) | Medium | Relaxed | Higher | Partial (structured metadata + long free text body) | No | Large | Internal + Confidential (per selected source records) |
| `knowledge.extract` | Structured fact/entity extraction from pasted text (Phase 003, CLOSED) | Medium | Fast-medium | Low-medium | Yes (extraction schema) | No | Medium | Internal (`public_internal`) |
| `agent.tools` | Future tool-calling agent tasks | High | Relaxed | Higher | Yes (tool-call schema) | Yes | Medium-large | Governed entirely by `docs/ai/ai-action-policy.md` |

`knowledge.extract` and `advisor.deep` are wired to real Phase 003 Company Brain features (fact extraction and the minimal read-only Q&A capability, respectively) — every other alias remains defined but unused, kept minimal rather than overbuilt ahead of the feature that will need it.

## Model Registry

A static, server-only configuration object (`lib/ai/model-registry.ts`) mapping each alias to: a primary model id, an ordered fallback list of model ids, and the alias metadata table above (latency/cost class, structured-output/tool requirements, sensitivity allowance). No database table is needed for this — see `prompts/002-openrouter-gateway.md` Database Impact for the reasoning.

## Sensitivity Allowance Enforcement (Phase 003 hardening, CLOSED)

Each alias's "Sensitivity allowance" column above is enforced at runtime, not just documented: `lib/ai/router.ts` calls `lib/ai/sensitivity.ts`'s `assertClassificationAllowed(alias, allowance, classification)` before any provider-routing decision or network call. A request classified above what its task alias allows fails with `TASK_SENSITIVITY_REJECTED` before OpenRouter is ever contacted — independent of whether a compliant (e.g. ZDR) provider is technically available for that classification. Secret is rejected unconditionally at every allowance tier. This check and `lib/ai/privacy.ts`'s provider-routing rules are both required; neither substitutes for the other.

## Embedding Model Configuration (Phase 003, CLOSED)

A separate, smaller registry entry: `OPENROUTER_EMBEDDING_MODEL` (currently `openai/text-embedding-3-small`), isolated behind `lib/ai/embeddings.ts` the same way chat models are isolated behind `lib/ai/client.ts`. The embedding vector dimension (`1536`, matching `knowledge_chunks.embedding vector(1536)`) is fixed for this schema version, unlike the chat model ids above — changing to a model with a different output dimension requires an explicit migration, re-embedding every existing chunk, and an index rebuild, never a runtime config change alone. `lib/ai/embeddings.ts` hard-checks the returned dimension and fails closed on any mismatch.

## Provider Registry

Phase 002 targets OpenRouter as the sole provider aggregator (per `docs/architecture.md`'s preferred stack); OpenRouter itself routes to underlying model providers (OpenAI, Anthropic, etc.) by model id. Orex OS's registry does not need its own separate "provider" abstraction layer beyond "which OpenRouter model id" — provider-level routing/failover is OpenRouter's own concern, not something Orex OS reimplements in Phase 002.

## Model Capability Requirements

Each alias's row above states its structured-output, tool, context-size, and reasoning requirements; the primary/fallback models chosen for an alias must satisfy them (e.g., a fast/low-cost alias should not default to a slow, expensive reasoning model as its primary choice). Enforcing this is a configuration-review responsibility (checked when the registry is edited), not a runtime check.

## Structured Output Models

Aliases marked "Yes" for structured output require a model known to support reliable structured/JSON output via OpenRouter; the gateway's structured-output validator (Zod) is the actual enforcement mechanism regardless of the model's own claimed support — see `prompts/002-openrouter-gateway.md` Structured Outputs.

## Tool Calling Models

`agent.tools` is the only alias requiring tool-call support in Phase 002, and it has no real tools registered yet (see `docs/ai/ai-action-policy.md`) — this alias exists as a placeholder so the parsing foundation has something realistic to target in tests.

## Long Context Models

`builder.long` and `advisor.deep` are the large-context aliases; their primary model choice should favor a larger context window over aliases like `ops.fast`, which favors low latency over context size.

## Fast Models

`ops.fast` is the explicit low-latency alias; its primary model should be selected for speed and cost first, structured/tool capability last.

## Deep Reasoning Models

`advisor.deep` and `risk.deep` are the explicit high-reasoning aliases; primary model choice favors reasoning quality over latency/cost.

## Cost Controls

Each alias declares a cost class (Low/Medium/Higher) informing which model tier its primary/fallback choices should draw from. Actual per-request cost is recorded in the usage record (see `prompts/002-openrouter-gateway.md` Usage/Cost Tracking) so cost-by-alias can be reviewed and registry choices adjusted without a code change.

## Model Fallback

If the primary model for an alias fails (see `docs/ai/openrouter-architecture.md` Fallback Strategy), the router tries the alias's fallback list in order, stopping at the first success. The fallback list itself is part of the alias's registry entry — a configuration change, not a code change.

## Provider Fallback

Not separately implemented in Phase 002 — since OpenRouter is the single provider aggregator, a fallback to a different model (potentially routed by OpenRouter to a different underlying provider) already achieves provider diversity without Orex OS needing its own provider-fallback layer.

## Privacy Constraints

An alias's sensitivity allowance (see the table above) is enforced by `docs/ai/context-policy.md`'s pipeline, not by model choice — routing never grants access to more sensitive data; it only determines which model processes the already-cleared context.

## Failure Handling

See `docs/ai/openrouter-architecture.md` Fallback Strategy and Error Handling in `prompts/002-openrouter-gateway.md`. An exhausted fallback chain returns a typed `FALLBACK_EXHAUSTED` error, never a fabricated or degraded-but-unlabeled result.

## Model Version Changes

Changing a model id (e.g., a provider ships a new version) is a registry edit, reviewed like any config change, with no feature-code impact. A material behavior change (e.g., swapping the model family, not just a version bump) should go through the evaluation gate in `docs/ai/evaluation-plan.md` before being promoted to primary for a given alias.

## Configuration Strategy

The registry lives in a TypeScript file (not the database) for Phase 002, since it changes rarely, benefits from type-checking against the alias metadata shape, and doesn't need runtime editability by non-engineers yet. A future admin UI for live-editing routing (if ever needed) would read/write a database-backed version of this registry — not built in Phase 002.

## Usage Analytics

Per-alias usage (call volume, cost, latency, error rate) is derivable from the usage records described in `prompts/002-openrouter-gateway.md` Usage/Cost Tracking — no separate analytics system is built in Phase 002.

## Evaluation Before Model Change

Per `docs/ai/evaluation-plan.md`: a proposed primary-model change for an alias should be evaluated against that alias's relevant quality/safety criteria before promotion, not swapped in purely on cost or availability grounds without any check.

## Proposed Initial Routing Table

All model ids below are **PROPOSED**, not permanent — they are placeholders to give the registry a concrete starting shape, subject to change without any architectural impact:

| Alias | Primary (PROPOSED) | Fallback (PROPOSED) |
|---|---|---|
| `advisor.deep` | a high-reasoning frontier model | a second high-reasoning model from a different family |
| `ops.fast` | a small/fast model | a second small/fast model |
| `finance.structured` | a mid-tier model with strong structured-output support | a second structured-output-capable model |
| `risk.deep` | a high-reasoning frontier model | a second high-reasoning model |
| `meeting.research` | a mid-tier model | a second mid-tier model |
| `builder.long` | a large-context model | a second large-context model |
| `knowledge.extract` | a fast, cheap extraction-capable model | a second extraction-capable model |
| `agent.tools` | a tool-calling-capable frontier model | a second tool-calling-capable model |

Actual model ids are decided at implementation time (`prompts/002-openrouter-gateway.md` Open Questions) once OpenRouter's current catalog and pricing are checked — not hard-coded by this planning document.

## Open Questions

1. Should fallback chains cross model *families* deliberately (to avoid correlated failures), or is same-family fallback acceptable for Phase 002's infrastructure-only scope? This document assumes cross-family fallback is preferable but doesn't mandate it, since no real model ids are chosen yet.
2. Should the registry support per-company or per-role model overrides (e.g., a company wanting cheaper models) in the future? Not needed for Phase 002; flagged for later if it becomes a real requirement.

Then stop.
