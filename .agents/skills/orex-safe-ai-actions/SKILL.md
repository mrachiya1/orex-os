# Orex Safe AI Actions

## Purpose

Reusable procedure for any future work that lets AI propose or perform mutations. Full architecture in `docs/ai/ai-action-policy.md` — this skill is the condensed checklist. Not applicable to Phase 002 (no actions are implemented there); use this when a later phase adds the first real AI-mutation feature.

## Core Rule

AI never receives unrestricted database mutation capabilities. It never executes arbitrary SQL, and it never mutates data without a human (or a narrowly pre-approved, explicitly designed) approval step.

## Action Lifecycle

```
User request
→ AI interpretation
→ typed proposal
→ schema validation (Zod)
→ exact target resolution
→ permission validation (against the approver, not the AI)
→ risk classification
→ approval (human, by default always required)
→ allowlisted server function
→ mutation
→ audit
→ result
```

## Action Types

Read, Draft, Recommend — no proposal/approval needed, these never mutate. Low-risk mutation, Approval-required mutation — go through the full lifecycle above. Forbidden — never implemented, regardless of framing (see Always Forbidden).

## Typed Action Proposal

```
{ action, companyId, resourceType, resourceId, arguments, reason, evidence, risk, requiresApproval }
```
`companyId` is server-resolved for the permission check, never trusted from AI output as an authorization signal. `arguments` are validated against a per-action Zod schema before anything else happens.

## Validation

A proposal that doesn't parse against its action-specific schema is rejected outright — never partially executed or "best effort" applied.

## Target Resolution

Never allow ambiguous target selection for destructive or financial actions — if the AI's interpretation could match more than one record, the proposal must fail or ask for disambiguation, not guess.

## Permission Validation

The permission check runs against the human approving the action (via `lib/permissions.hasPermission`), for the proposal's resolved `companyId` — never against the AI's own "authority," which doesn't exist as a permission concept.

## Risk Classification

Low / Medium / High / Critical, assigned per action *type* as a design-time configuration decision — never computed dynamically by the AI proposing the action (it must not grade its own request's risk).

## Approval Rules

Default: every action requires human approval, no exceptions. A Low-risk auto-executable category is only ever introduced via its own explicit, narrowly-scoped design and founder sign-off — never assumed or added casually.

## Always Forbidden

Arbitrary SQL execution from AI-generated content; revealing secrets through AI in any form; bypassing permissions; self-approval (the AI or its own session approving its own proposal); silent destructive actions; unapproved financial actions.

## Financial Actions

Always High or Critical risk, always require explicit approval from someone holding `finance.approve`/`transactions.approve` — never auto-executable regardless of amount.

## Permission Actions

Role/permission/membership-grant changes are always Critical risk and go through the same founder-level (`permissions.manage`) approval Phase 001 already requires — no AI shortcut.

## External Communication

Always High risk minimum; always requires explicit per-message approval before anything is actually sent.

## Destructive Actions

Always High or Critical risk. Where the data model supports soft-delete (as Phase 001's tables already do), an AI-proposed "delete" should default to proposing the soft-delete path.

## Idempotency

Proposing must be side-effect-free (only approved execution mutates), so rejecting and re-proposing is always safe.

## Replay Protection

An approval decision is tied to one specific proposal instance, not a reusable token — mirrors the single-use invitation-token pattern from Phase 001. Approving once must not be replayable to execute twice.

## Tool Registry

A named, schema-validated allowlist mapping tool name → argument schema → required permission → risk level → the actual server function invoked after approval. Nothing is added to this registry without going through this entire skill's checklist.

## Audit Requirements

An executed AI action writes an `audit_logs` row identical in shape to a human-initiated mutation, with `ai_session_id`/`ai_agent_id`/`approval_status`/`approval_user_id` populated (fields already present in the Phase 001 schema).

## Error Behavior

A failed execution is recorded with `result_status: "failure"`, same as any other mutation — no special-cased AI failure path that skips audit logging.

## User Preview

Before approval, the human must see the actual proposal (action, target, arguments, reason, evidence) — never approve a black-box "let the AI do it" request.

## Testing Checklist

A proposal cannot execute without approval. A proposal cannot escalate beyond the approver's own permissions. Every executed action is fully audited. A malformed proposal is rejected before reaching permission checks. Self-approval is impossible. Financial/permission/destructive actions cannot be marked auto-executable by configuration mistake alone (require an explicit, reviewed override).

## Common Mistakes

Letting the AI's stated risk level be trusted without independent classification; approving via a generic "yes" button that doesn't show the actual proposal; wiring a tool directly to a raw database write instead of an allowlisted, already-permission-checked server function; treating "the AI seemed confident" as equivalent to permission or approval; reusing an approval token for a second execution.

## Example Safe Actions

Create a project draft (Draft type, no approval needed since nothing is committed). Update a project's status (Low/Medium risk, approval required). Prepare an invoice draft (Draft type). Draft a client follow-up message (Draft type; sending it is a separate, always-approval-required External Communication action).

## Example Unsafe Actions

Deleting finance history without approval. Transferring money autonomously. Revealing an API key or secret through any AI-facing surface. Silently granting administrator/permission access.

Do not implement AI actions from this file alone — this is architecture guidance for whichever future phase builds the first real one, paired with that phase's own approved prompt.
