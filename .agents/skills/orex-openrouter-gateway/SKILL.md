# Orex OpenRouter Gateway

## Purpose

Implementation skill for any task touching Orex OS's AI gateway (`lib/ai/`). Full architecture rationale lives in `docs/ai/openrouter-architecture.md` and `docs/ai/model-routing.md` — this skill is the condensed, actionable checklist for implementing against it correctly.

## Architecture Rule

No product module calls OpenRouter directly. All model communication goes through the internal Orex AI gateway. If you're writing a feature that needs AI and you're importing an OpenRouter client or constructing a raw API request yourself, stop — you're bypassing the gateway.

## Required Request Flow

```
Feature → gateway entrypoint (task alias + typed input)
→ authenticate (lib/auth)
→ permission check (lib/permissions.hasPermission, ai.use minimum)
→ company scope (server-resolved, never client-trusted)
→ context builder (task-minimal, per docs/ai/context-policy.md)
→ redaction (Secret always stripped; Restricted/Confidential per allowlist)
→ model router (alias → primary/fallback models)
→ OpenRouter call (timeout + bounded retry)
→ structured-output validation (Zod)
→ usage tracking write
→ typed result or typed error
```

Every stage above must exist for every gateway call — do not add a shortcut path that skips permission checking or redaction "just for this one feature."

## Server-Only Rule

`OPENROUTER_API_KEY` must never enter browser code. Every file that imports the OpenRouter client starts with `import "server-only"`, matching the existing pattern in `lib/auth/session.ts` and `lib/permissions/index.ts`. After any change touching `lib/ai/`, grep the built `.next/static` bundle for the key string before considering the change done — the same check Phase 001 established for the Supabase service-role key.

## Proposed Gateway Components

`lib/ai/client.ts` (OpenRouter HTTP client), `lib/ai/gateway.ts` (the entrypoint feature code calls), `lib/ai/router.ts` (alias → model resolution + fallback), `lib/ai/model-registry.ts` (the alias table), `lib/ai/context-builder.ts`, `lib/ai/context-policy.ts` (redaction), `lib/ai/usage.ts`, `lib/ai/errors.ts` (normalized error types), `lib/ai/schemas/` (per-task Zod schemas), `lib/ai/tools/` (future tool-call parsing foundation only). Confirm the exact set actually created against `prompts/002-openrouter-gateway.md` before assuming this list is final — it's a starting point, not a contract.

## Model Aliases

`advisor.deep`, `ops.fast`, `finance.structured`, `risk.deep`, `meeting.research`, `builder.long`, `knowledge.extract`, `agent.tools`. Full per-alias requirements (latency/cost class, structured-output/tool needs, sensitivity allowance) are in `docs/ai/model-routing.md` — don't invent new aliases without updating that table.

## Model Independence

Feature code requests an alias/capability, never a provider model id. If you find yourself writing `"anthropic/claude-..."` or similar directly in feature code, that's wrong — it belongs only in `lib/ai/model-registry.ts`.

## Provider Routing / Fallbacks

OpenRouter is the sole provider aggregator; Orex OS doesn't build its own provider-failover layer beyond the model-level fallback list per alias. See `docs/ai/model-routing.md` Fallback Strategy.

## Structured Outputs

Every task alias has a Zod schema for its expected result shape. Parse-then-validate; a response failing validation is a failure (`INVALID_STRUCTURED_OUTPUT`), never silently coerced, defaulted, or partially trusted.

## Tool Calling

Phase 002 parses tool-call-shaped responses but registers no real tools and grants no database access from AI output. Any mutation-capable tool must follow `docs/ai/ai-action-policy.md` and `.agents/skills/orex-safe-ai-actions/SKILL.md` — never wire a tool straight to a database write.

## Timeout Rules

Every OpenRouter call has a bounded timeout; a timeout is a fallback-triggering failure, not a hang.

## Retry Rules

One bounded retry for transient errors (timeout, 5xx, rate limit) against the same model, then fall back to the next model in the alias's chain. Non-transient errors (validation failure, permission denied) fail immediately — no retry.

## Rate Limits

Handle OpenRouter rate-limit responses via the retry/fallback rule above. Orex OS's own inbound rate limiting (who can call the gateway how often) is a known open gap carried from Phase 001 — don't assume it exists.

## Cost / Token / Latency / Provider / Prompt-Version Tracking

Every gateway call (success or failure) records: actor, org/company, task alias, resolved model, provider, input/output/total tokens, estimated cost, latency, result status, prompt version, and (on failure) a normalized error classification. Never record raw prompt/response content that could contain Secret-classified data.

## Context Privacy

Governed entirely by `docs/ai/context-policy.md` and `.agents/skills/orex-ai-context-policy/SKILL.md` — read those before building any context-assembly code.

## ZDR / Provider Privacy Policy Integration

Not implemented in Phase 002. Orex OS's obligation is to never send data that shouldn't leave the server, independent of what OpenRouter/underlying providers promise about retention — don't treat a provider's zero-data-retention claim as a substitute for redaction.

## Error Handling

Normalize every failure mode (provider unavailable, model unavailable, timeout, rate limit, invalid response, invalid structured output, context construction failure, permission denied, company resolution failure, fallback exhausted) into a typed error. Never leak provider secrets, the API key, or raw internal context in an error message returned to a caller.

## Logging

Never log sensitive prompt contents blindly. Structured logs may reference task alias, model, timing, and error classification — not full prompt/response text.

## Testing Checklist

Before considering gateway work done, verify: OpenRouter key absent from the browser bundle; an unauthenticated request is denied; a request cannot pull another company's data into context; secret-shaped fields are stripped from context; an unknown alias fails safely; primary-model failure falls back correctly; an exhausted fallback chain returns a safe typed error; invalid structured output is rejected, not coerced.

## Browser Exposure Test

`grep` the production build output for the API key string — must return nothing.

## Company Isolation Test

Call the gateway as a user in Company A with a context request that could plausibly touch Company B data; assert Company B data never appears in the built context.

## Secret Redaction Test

Feed the redaction pass a context object containing a field named like a secret (`password`, `token`, `api_key`, etc.); assert it's stripped regardless of task or permission.

## Fallback Test

Force the primary model to fail (mock/test double) and assert the router calls the next model in the alias's fallback list, then returns `FALLBACK_EXHAUSTED` once the list is exhausted.

## Structured Output Test

Feed the validator a response that doesn't match the task's schema; assert it's rejected, not silently accepted.

## Common Mistakes

Instantiating an OpenRouter client outside `lib/ai/`; hard-coding a model id in feature code instead of using an alias; trusting a client-supplied company id for context scoping; logging full prompt/response content; treating a provider's privacy policy as a substitute for redaction; auto-retrying a permission-denied or validation failure as if it were transient.
