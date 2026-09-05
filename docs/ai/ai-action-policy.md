# Orex OS AI Action Policy

## Principles

AI never mutates data directly. Every AI-proposed action becomes a typed, validated, permission-checked proposal that a human (or, for narrowly pre-approved low-risk cases, an explicit auto-execute rule) must clear before an allowlisted server function actually performs the mutation. This mirrors AGENTS.md §10 exactly and reuses Phase 001's permission/audit machinery rather than inventing a parallel one.

## Read-Only AI

Phase 002 implements only read/generate infrastructure (context in, structured result out). No AI-initiated mutation exists in Phase 002 — this document defines the architecture a *later* phase will implement when a real mutation-capable feature is built, so that feature doesn't have to design this from scratch.

## AI Recommendations

Non-binding suggestions surfaced to a user (e.g., "this project looks at risk"). No action proposal, no approval flow — just a structured, evidence-linked result per `docs/design-system.md`'s AI Recommendation UI. Fully in scope for later feature phases; the gateway infrastructure they'll use is Phase 002's actual deliverable.

## AI Drafts

Generated content (a draft proposal, report, email) that a human reviews and explicitly saves/sends — the AI never publishes or sends anything itself. Also a later-phase feature concern, using Phase 002's structured-output infrastructure.

## AI Mutation Requests

The category this document governs: an AI interpreting a user's request into a specific, typed proposal to change data. Not implemented in Phase 002; architecture defined here for later phases.

## Action Proposal Schema

Conceptually (Zod schema, defined when the first real action-capable feature ships, not in Phase 002):

```
{
  action: string;          // e.g. "projects.update_status"
  resource: string;        // e.g. "projects"
  resourceId: string;
  companyId: string;       // server-resolved, never AI-supplied as authorization
  arguments: Record<string, unknown>;  // validated against an action-specific schema
  reason: string;          // human-readable justification the AI provides
  evidence: string[];      // source record references supporting the reason
  risk: "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
}
```

## Validation

Every proposal's `arguments` are validated against a per-action Zod schema before anything else happens — an AI response that doesn't parse into a valid proposal is rejected outright, never partially executed.

## Permission Checks

The proposal's `action` maps to a normal Orex OS permission (e.g., `projects.update`). The *human* who ultimately approves (or the auto-execute path, if ever used) must hold that permission for the proposal's `companyId` — checked via the same `lib/permissions.hasPermission()` used everywhere else. The AI's own "authority" is never treated as sufficient; a proposal is only ever as authorized as the human approving it.

## Risk Classification

Conceptual levels — Low, Medium, High, Critical — assigned per action type (a config decision made when each action is defined), not computed dynamically by the AI itself (an AI should never get to grade its own request's risk).

## Auto-Executable Actions

Extremely conservative: in Phase 002 and for the foreseeable future, **no** action auto-executes without human approval. If a future phase ever proposes a Low-risk auto-executable category (e.g., a purely informational tag update), it requires its own explicit, narrowly-scoped design and founder sign-off — never a default.

## Approval Required Actions

All of them, by default, until an explicit exception is designed and approved per Auto-Executable Actions above.

## Always Forbidden Actions

The AI must never: execute arbitrary generated SQL, reveal secrets, bypass permissions, change roles/permissions without the approved human workflow, send payments, or delete critical records without explicit human approval. These are hard architectural rules, not configuration — no allowlisted server function may accept raw SQL or a permission/role mutation triggered purely by AI inference.

## Financial Actions

Always High or Critical risk, always require explicit approval from a user holding `finance.approve`/`transactions.approve` — never auto-executable, regardless of amount.

## Permission Actions

Changes to roles, permissions, or `organisation_members`/`company_members` grants are always Critical risk and always require the same founder-level approval Phase 001 already requires for those mutations (`permissions.manage`) — AI never gets a shortcut around that.

## External Communication

Sending anything externally (email, messages) on the user's behalf is always High risk minimum and always requires explicit per-message human approval before send — never auto-sent based on an AI draft alone.

## Destructive Actions

Deletions (as opposed to archiving/soft-delete, which Phase 001's own tables already prefer) are always High or Critical risk and require explicit approval; where the underlying data model supports soft-delete (as Phase 001's tables do), an AI-proposed "delete" should default to proposing the soft-delete path, not a hard delete.

## Tool Registry

A future allowlist of named, schema-validated functions an AI may propose calling — each entry maps a tool name to: its argument schema, its required permission, its risk level, and the actual server function it invokes after approval. Not populated in Phase 002 (no tools are registered); Phase 002 only builds the response-parsing foundation for recognizing that a model *proposed* calling a tool.

## Allowlisted Server Functions

The only code path that ever executes an AI-originated mutation, once approved. These are ordinary, already-permission-checked, already-audited server actions (the same pattern Phase 001 established for `inviteMember`, `removeMember`, etc.) — an approved AI action proposal ultimately just calls one of these, indistinguishable at that point from a human-initiated call to the same function.

## Audit Requirements

An approved-and-executed AI action writes an `audit_logs` row identical in shape to a human-initiated mutation, plus `ai_session_id`/`ai_agent_id`/`approval_status`/`approval_user_id` fields (already present in the Phase 001 `audit_logs` schema — see `docs/data-model.md`) populated. A *rejected* or *never-approved* proposal is not necessarily audit-logged at the same table (it may just be a usage record, per `docs/ai/openrouter-architecture.md`'s usage/audit distinction), unless the rejection itself is security-relevant (e.g., repeated attempts at a forbidden action).

## Action Results

An executed action returns the same result shape its underlying server function already returns — no separate "AI result" wrapper beyond the surrounding proposal/approval metadata.

## Failed Actions

A failed execution (the underlying server function throws) is recorded with `result_status: "failure"` in the audit log, same as any other Phase 001 mutation failure — no special AI failure path.

## Idempotency

Action proposals should be safe to reject and re-propose without side effects (proposing is free; only approved execution mutates). Where the underlying action isn't naturally idempotent (e.g., "send this email"), the approval UI (a later phase) must make clear that approving executes exactly once.

## Replay Protection

An approval decision should be tied to a specific proposal instance (not a reusable token), so approving once cannot be replayed to execute the same mutation twice — mirrors the single-use invitation-token pattern Phase 001 already established.

## Testing

Not applicable in Phase 002 (no actions exist to test) — this document's testing requirements apply to the future phase that implements the first real AI-mutation feature: verify a proposal cannot execute without approval, cannot escalate beyond the approver's own permissions, and is fully audited.

## Phase 002 Scope

Phase 002 does not implement any part of this document's mutation architecture. It exists so future phases building real AI actions inherit a consistent, already-reviewed design rather than each inventing their own.

## Future Agent Use

The AI Agents module (AGENTS.md §12) will be the primary consumer of this architecture once built — each agent's allowed actions come from the Tool Registry described above, scoped per agent per `docs/product-scope.md`'s AI Agents section.

## Open Questions

1. Should risk classification ever be data-dependent (e.g., a `finance.update` on a small amount vs. a large one) rather than purely action-type-based? Deferred to whichever future phase implements the first financial action.
2. Should there be a "reject and explain" flow that feeds back into prompt/model evaluation (per `docs/ai/evaluation-plan.md`) so repeated bad proposals inform model/prompt tuning? Deferred, not needed until real actions exist.

Then stop.
