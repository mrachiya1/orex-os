# Orex OS AI Evaluation Plan

## Goals

Know, with evidence, whether an AI feature's output is accurate, safe, and useful before it ships, and keep knowing after it ships — never rely on "it looked good in one test" as the bar for something that will influence real business decisions.

## Evaluation Principles

Every AI feature is evaluated against criteria specific to its task category (see per-category sections below) before its prompt/model reaches `active` status (`docs/ai/prompt-versioning.md`). Safety and permission-boundary tests (hallucination, leakage, isolation) apply to every AI feature regardless of category and are non-negotiable release gates. No AI feature ships to real users without at least the safety-test category passing.

## Offline Evaluation

Running a fixed set of representative inputs through a candidate prompt/model version and checking outputs against expected criteria (schema validity, groundedness, safety) before any real traffic sees it. Phase 002 doesn't build an offline-eval harness (no real prompts exist yet), but its structured-output validation (Zod) is the mechanical piece any future harness will reuse to check "did the output even parse."

## Production Evaluation

Sampling real (permission-appropriate, redacted) usage records for periodic human review, tracking the metrics below over time. Depends on the usage-tracking infrastructure Phase 002 does build (`docs/ai/openrouter-architecture.md` Usage Tracking) — Phase 002 is what makes production evaluation *possible* later, without itself running any evaluation.

## Human Feedback

A future lightweight "was this useful" signal on AI outputs (thumbs up/down or similar), feeding into the production-evaluation review — not built in Phase 002 (no AI-facing UI exists yet).

## Advisor Evaluation

Once built: recommendations must cite evidence (source records), state confidence, and avoid presenting inference as verified fact — directly enforced by the structured-output schema for `advisor.deep`-category results, not left to prompt wording alone.

## Finance Evaluation

Once built: structured extraction/summary accuracy against known financial figures; zero tolerance for fabricated numbers — any numeric claim must trace to a source record in the context, checked via the evidence/source-reference mechanism in `docs/ai/context-policy.md`.

## Risk Evaluation

Once built: risk scores must be evidence-based (per AGENTS.md's ban on unsupported inference) — evaluation checks that every risk score's evidence field actually supports the score, not just that a score was produced.

## Meeting Brief Evaluation

Once built: briefs must accurately summarize prior interactions without inventing decisions/commitments that weren't actually made.

## Knowledge Extraction Evaluation

Once built: extracted facts must be checked against source documents for accuracy, and (per AGENTS.md and `docs/data-model.md`'s data-model rule) verified facts must remain structurally distinguishable from AI inference — evaluation includes checking this separation is actually preserved in output, not just described in docs.

## Builder Evaluation

Once built: generated documents (proposals, reports) are drafts by definition (AGENTS.md §13) — evaluation focuses on whether generated content faithfully reflects its selected source records, not on treating any output as final without human review.

## Agent Evaluation

Once built: tool-selection correctness, action-proposal accuracy, and approval-rejection rate (a high rejection rate signals the agent is proposing bad actions, a real quality signal) — depends on `docs/ai/ai-action-policy.md`'s architecture existing first.

## Metrics

Accuracy, groundedness (are claims traceable to source context), completeness, relevance, actionability, safety, latency, cost, tool-call success rate, approval-rejection rate, and user-reported usefulness. Latency and cost are already captured by Phase 002's usage tracking; the rest require task-specific evaluation logic built alongside each real feature.

## Hallucination Testing

Checking that outputs don't state unsupported facts — most directly testable for structured-output tasks with an `evidence`/source-reference field (per `docs/ai/context-policy.md`), by verifying every claim resolves to something present in context.

## Permission Leakage Testing

Verifying an AI response for User A, Company X never reflects data User A couldn't otherwise see, or that belongs to a different company — mechanically enforced upstream by the context builder/permission check (Phase 002), but still worth periodic adversarial testing (crafted prompts trying to get the model to "recall" or guess at unseen data) once real context exists.

## Company Isolation Testing

Same discipline as Phase 001's company-isolation tests, applied to AI: a request scoped to Company A must never have Company B's data reachable anywhere in its context or result — testable at the Phase 002 infrastructure layer even before real features exist, by asserting the context builder's company-scoping rule directly (see `prompts/002-openrouter-gateway.md` Automated Tests).

## Secret Leakage Testing

Verifying no Secret-classified field, and no application secret (Supabase/Resend/OpenRouter keys), ever appears in context sent to the model, in the model's response, in usage records, or in logs — testable at the Phase 002 infrastructure layer directly (redaction pipeline unit tests), independent of any real feature.

## Structured Output Testing

Verifying the Zod validation step actually rejects malformed/unexpected model output rather than silently coercing it — a core Phase 002 test (see `prompts/002-openrouter-gateway.md` Automated Tests #9).

## Tool Selection Testing

Not applicable until real tools exist (`docs/ai/ai-action-policy.md` Tool Registry) — deferred.

## Model Comparison

Running the same task against candidate primary/fallback models before promoting a new one in the registry (`docs/ai/model-routing.md`), using the task-category-specific criteria above.

## Prompt Comparison

Same idea applied to prompt versions (`docs/ai/prompt-versioning.md`) — a new `draft` version is compared against the current `active` one before promotion.

## Regression Testing

Re-running the offline evaluation set whenever a prompt or model changes for an alias already in production use, to catch quality regressions before they reach real traffic.

## Evaluation Dataset Strategy

Built incrementally per task category as real features ship — Phase 002 does not create any evaluation datasets (there are no real prompts/features yet to build them against).

## Production Sampling

A periodic (e.g., weekly) manual review of a sample of usage records per active alias, once real traffic exists — a process, not infrastructure Phase 002 builds.

## Cost Monitoring

Directly supported by Phase 002's per-call cost tracking (`docs/ai/openrouter-architecture.md`) — reviewing aggregate cost-by-alias is a query over usage records, not new infrastructure.

## Release Gate

No AI feature's prompt/model version is promoted from `draft` to `active` (`docs/ai/prompt-versioning.md`) without passing: schema validation on representative inputs, the safety-test categories above (leakage, isolation, hallucination-for-evidence-bearing tasks), and a basic sanity review of output quality for its task category.

## Rollback Conditions

A production quality or safety regression (elevated approval-rejection rate, a confirmed leakage or isolation failure, a spike in structured-output validation failures) triggers reverting the affected alias's `active` prompt/model version to the last known-good one (`docs/ai/prompt-versioning.md` Rollback) — a config change, not a data migration.

## Open Questions

1. Should Orex OS build a lightweight internal eval harness (a script that runs a fixture set through the gateway and reports pass/fail) as part of Phase 002's infrastructure, even with no real prompts to test yet — so the *pattern* exists before the first real feature needs it? Recommend deferring to the first real feature phase, since a harness built against hypothetical prompts risks being redesigned anyway once real requirements are known.
2. What's the minimum sample size/frequency for production sampling once real traffic exists? Deferred until real usage volume exists to reason about.

Then stop.
