# 013 — Orex AI Action Engine (permanent architecture)

## Files inspected

- `app/actions/knowledge.ts` (full), `lib/ai/gateway.ts`, `lib/ai/router.ts`, `lib/ai/client.ts`,
  `lib/ai/embeddings.ts`, `lib/ai/context-builder.ts`, `lib/ai/redaction.ts`, `lib/ai/privacy.ts`,
  `lib/ai/sensitivity.ts`, `lib/ai/model-registry.ts`, `lib/ai/structured-output.ts`, `lib/ai/usage.ts`,
  `lib/ai/errors.ts`, `lib/ai/schemas/knowledge.ts` — the existing AI gateway/pipeline (Phase 002).
- `lib/permissions/index.ts`, `lib/permissions/catalog.ts`, `lib/permissions/role-cap.ts` — full permission
  catalog (36 keys, including `AI_USE`/`AI_APPROVE`/`AI_MANAGE` — the latter two exist but are **not referenced
  anywhere in code today**, strongly suggesting they were pre-provisioned for exactly this).
- `lib/audit/index.ts` (`writeAuditLog`, already supports `actorType: "ai_agent"`), `lib/projects/activity.ts`.
- `lib/projects/lifecycle.ts` (`assertValidTransition`, `requiredPermissionsForTransition`), `lib/projects/readiness.ts`
  (`checkProjectReadiness`) — the lifecycle/readiness gates a future status-changing tool must never bypass.
- `app/actions/project-tasks.ts` (full) — the exact human-facing pattern a tool handler should mirror:
  `requireCurrentUser` → `requireProjectAccess` → resolve `organisation_id`/`company_id` **from the project row
  itself, never from client input** (`getProjectScope`, line 10) → mutate → `writeAuditLog` → `writeProjectActivity`.
- `lib/validation/projects.ts` (`createTaskSchema` and sibling schemas), `lib/actions/result.ts`.
- Confirmed via repo-wide grep: **no `ai_action_requests`/`ai_action_results`/`agent_registry`/`ai_agents` table
  exists anywhere.** AGENTS.md section 8 lists these as "recommended core records" — they were never built. This
  is green-field on the database side.
- Confirmed: `MODEL_REGISTRY` (`lib/ai/model-registry.ts`) already reserves a `agent.tools` task alias with
  `requiresTools: true`, explicitly commented "not wired to any real feature yet" — this is the intended alias
  for the orchestrator below.

## What exists that must be preserved

Every existing server action, permission check, RLS policy, and the Company Brain Q&A flow (`askCompanyBrain`,
just fixed in the previous commit) are unchanged by this work. This is a new, additive layer that *calls into*
existing infrastructure — it never replaces `app/actions/*.ts`, never adds a new way to mutate the database that
bypasses `hasPermission`/`hasProjectAccess`/RLS, and never touches `lifecycle.ts`/`readiness.ts`'s gates.

## Decisions

1. **AI never writes SQL and never gets a privileged client.** Every tool handler either (a) calls an existing
   `app/actions/*.ts` function directly (full reuse — zero duplicated validation/permission/audit logic), or
   (b) for read-only tools, runs a plain query through the normal RLS-enforced `createServerSupabaseClient()`
   (never `createServiceRoleClient()`). A tool can never see more than the acting human could see themselves.
2. **The agent acts as the current user, always.** Every tool invocation resolves `actorUserId` via
   `requireCurrentUser()` — there is no "agent identity" with its own database permissions. `agentId` is metadata
   describing *which* configured agent is making the call on the user's behalf, recorded for audit only.
3. **One new table, not two.** The prompt's conceptual `ai_action_requests`/`ai_action_results` becomes a single
   `ai_action_requests` table whose `status` column carries the full lifecycle (`proposed` → `approved`/`rejected`
   → `executed`/`failed`), with `result`/`error_message` columns on the same row. This is the authoritative
   AI-specific audit record — it exists *alongside* whatever `audit_logs`/`project_activity` rows the reused
   human-facing action already writes (e.g. `createTask` still writes its own `task.created` audit row tagged
   `actorType: "human"`, which is factually correct — the human's account performed it, via AI). Avoids the
   "Do not create duplicate cost tracking" instruction's spirit by not duplicating what `audit_logs`/
   `ai_usage_events` already do.
4. **Agent Registry is static TypeScript, not a database table** — per the prompt's own "smallest maintainable
   architecture" allowance. `lib/ai/agents/registry.ts` exports a typed `Record<string, AgentDefinition>`.
   Revisiting this as a DB table is a future decision if/when agents need to be edited without a deploy.
5. **Risk levels 0-3 are real; level 4 doesn't exist as data.** A "level 4 forbidden" action (arbitrary SQL,
   revealing secrets, changing RLS, granting itself permissions, etc.) is never expressed as a `ToolDefinition`
   at all — there is no tool to forbid, because no such tool is ever registered. The registry is an allowlist;
   anything not in it is already refused by construction, before any risk check runs.
6. **Autonomy mode is enforced by the executor, independent of a tool's own risk level.** A `CONFIRM_TO_ACT`
   agent must confirm before executing *any* mutation, even a `safe_update` (risk 1) tool — the agent's
   configured autonomy mode is an *additional* ceiling on top of the tool's own default, never a way to loosen it.
7. **Scope of tool coverage for this pass, per the prompt's explicit instruction ("implement only enough to
   demonstrate one read operation and one safely controlled project mutation"):**
   - `projects.search` (risk 0, read-only) — company-scoped project name/code search.
   - `projects.task.create` (risk 1, safe update) — wraps the existing `createTask` action verbatim.
   - No other domain tools (knowledge, decisions, team, delivery) are implemented this pass — the registry and
     executor are built to make adding them mechanical later, but adding them is future work.
8. **Two-tier scope — see "Tier 1 / Tier 2" below.** The backend action engine (Tier 1) is unambiguous and
   should be built regardless. Whether to also wire natural-language command routing into the Company Brain UI
   this same pass (Tier 2) is a real product/scope decision — flagged for your explicit choice, not assumed.

## Architecture

```
supabase/migrations/00XX_ai_action_engine.sql
  ai_action_requests (id, organisation_id, company_id, project_id nullable,
    agent_id text, actor_user_id, tool_name, risk_level smallint,
    status text check in ('proposed','approved','rejected','executed','failed'),
    input jsonb, result jsonb, reason text nullable,
    requested_at, decided_by nullable, decided_at nullable,
    executed_at nullable, error_message text nullable)
  RLS: select requires ai.use AND (actor_user_id = auth.uid() OR ai.approve on the company);
  no client-facing INSERT/UPDATE policy at all -- every write goes through the
  service-role client from lib/ai/tools/approval.ts, exactly like audit_logs.

lib/ai/tools/
  types.ts          ToolDefinition<TInput,TOutput>, ActorContext, RiskLevel (0|1|2|3)
  registry.ts        TOOL_REGISTRY: Record<string, ToolDefinition>, getTool(name)
  risk.ts            requiresApprovalByDefault(risk), isExecutionAllowed(autonomyMode, risk, approved)
  authorization.ts   authorizeToolCall(tool, input, actor) -- routes to hasPermission/
                     hasProjectAccess/requireOrgPermission by tool.scopeType
  approval.ts        proposeAction(), recordApprovalDecision() -- service-role writes to
                     ai_action_requests; re-checks the approver's OWN permission at
                     decision time, never trusts the original proposal's authorization
  executor.ts        executeTool(toolName, rawInput, agentId) -- the single entrypoint
                     every feature (Company Brain, future Advisor/Agents) must call;
                     never lets a thrown error escape, returns ActionResult
  schemas.ts         re-exports the Zod schemas each tool's inputSchema uses (mostly
                     imported from existing lib/validation/*.ts -- new ones only where
                     no equivalent exists yet, e.g. projects.search's {companyId, query})
  projects.ts        the two Tier-1 tool definitions

lib/ai/agents/
  registry.ts        AgentDefinition type + one static entry ("advisor") for this pass
```

### `ToolDefinition`

```ts
type RiskLevel = 0 | 1 | 2 | 3; // READ_ONLY / SAFE_UPDATE / IMPORTANT_UPDATE / HIGH_RISK

interface ToolDefinition<TInput, TOutput> {
  name: string;                    // "projects.task.create"
  description: string;             // shown to the model in the orchestrator prompt
  domain: string;                  // "projects"
  requiredPermission: PermissionKey;
  scopeType: "organisation" | "company" | "project";
  riskLevel: RiskLevel;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput, actor: ActorContext) => Promise<TOutput>;
}

interface ActorContext {
  userId: string;
  agentId: string;
}
```

### `executeTool` flow

1. Look up `toolName` in `TOOL_REGISTRY` — unknown name → `{ ok: false, error: "Unknown tool." }` immediately.
   This is the "AI cannot request unknown tool" guarantee, enforced structurally, not by prompt instruction.
2. `requireCurrentUser()` → build `ActorContext`.
3. `tool.inputSchema.safeParse(rawInput)` — malformed input never reaches a handler.
4. `authorizeToolCall(tool, input, actor)` — resolves the correct permission check for `tool.scopeType`
   (`hasProjectAccess` for `"project"`, resolving the company/org from the *database row*, never from
   `rawInput` — mirrors `getProjectScope` in `project-tasks.ts`). Denial → `{ ok: false, error: "..." }`.
5. Resolve the invoking `AgentDefinition` from `lib/ai/agents/registry.ts`; verify `toolName` is in its
   `allowedTools` and `tool.riskLevel <= agent.maxRiskLevel` — an agent can never use a tool outside its own
   configured ceiling, regardless of what the human's own permissions would otherwise allow.
6. `isExecutionAllowed(agent.autonomyMode, tool.riskLevel, alreadyApproved: false)` — if `false`, call
   `proposeAction(...)` (writes `status: 'proposed'`) and return `{ ok: true, status: "pending_approval", requestId }`
   **without calling `tool.handler` at all**.
7. Otherwise, execute now: `tool.handler(input, actor)` in try/catch. Success → write the `ai_action_requests`
   row directly as `status: 'executed'` (a durable record exists even for auto-executed actions) and return
   `{ ok: true, status: "executed", output }`. Failure → `status: 'failed'`, safe error message via
   `toSafeAIErrorMessage`, return `{ ok: false, error }` — **never reports success for a failed handler.**

### Approval path (separate action, human-triggered only)

`approveActionRequest(requestId, decision: "approved" | "rejected")`:
- `requireCurrentUser()` → the approver.
- Loads the `ai_action_requests` row; must still be `status: 'proposed'` (idempotent — a second approval attempt
  on an already-decided row is a no-op error, not a double-execution).
- **Re-checks the approver's own permission for `tool.requiredPermission` right now** — never trusts that the
  original proposal was authorized correctly; an approver without the permission themselves cannot approve it
  into existence for someone else. This is also how "the agent cannot approve its own high-risk action" is
  enforced: there is no code path by which `executeTool` or any AI-facing function can call this action —
  it only exists as a human-invoked Server Action reachable from a UI button.
- On `"approved"`: sets `decided_by`/`decided_at`, then executes the tool handler exactly like step 7 above,
  updating the same row to `executed`/`failed`.
- On `"rejected"`: sets `decided_by`/`decided_at`/`status: 'rejected'`, never calls the handler.

## Tier 1 vs Tier 2 — your decision needed

**Tier 1 (the permanent architecture itself)** — always built this pass regardless of your answer below:
migration, `lib/ai/tools/*`, `lib/ai/agents/registry.ts`, the two Tier-1 tools, `approveActionRequest`, tests.
Demonstrated via a direct integration test calling `executeTool("projects.search", ...)` and
`executeTool("projects.task.create", ...)` against a real (test) project — satisfying "one read operation and
one safely controlled project mutation through the permanent agent action architecture" literally.

**Tier 2 (natural-language command routing wired into Company Brain's existing UI)** — a real scope choice:
- A new task alias use of the already-reserved `agent.tools` model route, a system prompt + structured-output
  schema that classifies a message as `answer | tool_call | needs_clarification`, a new server action
  (`runCompanyBrainCommand`) that routes to either the existing `askCompanyBrain` logic or `executeTool`, and a
  UI update to `AskCompanyBrainBox.tsx` to render a confirm/cancel action card and a completed-action result,
  instead of only plain text.
- This is what makes the prompt's own "TEST A"/"TEST B" (typing "What active projects do we have?" or "Add a
  task called 'Review final render' to Test Project" into the Company Brain box) actually work end-to-end in the
  browser today, rather than only via a backend test.
- It is a genuinely separate, non-trivial piece of prompt engineering and UI work on top of Tier 1, and skipping
  it this pass does not weaken the architecture in any way — Tier 1 is fully usable by Tier 2 whenever you want
  it built.

## Security implications

- No new way to bypass RLS: every tool handler goes through the normal authenticated client or an existing,
  already-audited action. The service-role client is used only for `ai_action_requests` writes (matching
  `audit_logs`'/`ai_usage_events`'s existing no-client-INSERT-policy convention).
- No self-approval: approval is a distinct human Server Action, never reachable from `executeTool` or any AI
  code path, and re-validates the approver's permission independently.
- No privilege escalation: an agent's `allowedTools`/`maxRiskLevel` can only narrow what the acting human could
  already do, never widen it — `authorizeToolCall` still runs the human's real permission check regardless of
  agent configuration.
- No secret/private-profile exposure: no Tier-1 tool touches `user_private_profiles`, the secrets vault, or any
  `SECRETS_*`/service-role-only table. `ActorContext` carries only `userId`/`agentId` — no tokens, no keys.
- Prompt injection: retrieved knowledge/company content is already treated as untrusted `context` data by the
  existing gateway (`lib/ai/context-builder.ts`); the Tier 2 orchestrator's system prompt will explicitly state
  that tool selection is determined by the fixed registry and this code's policy, never by instructions found
  inside retrieved content — matching the existing `askCompanyBrain` system prompt's own framing.

## Acceptance criteria

1. `executeTool("projects.search", { companyId, query }, "advisor")` returns real, permission-scoped project
   rows for a user who can read that company's projects, and `{ ok: false }` for one who can't.
2. `executeTool("projects.task.create", {...}, "advisor")` for a `CONFIRM_TO_ACT` agent (the only one configured
   this pass) never executes immediately — it always returns `pending_approval` with a `requestId`.
3. `approveActionRequest(requestId, "approved")` by a user holding `projects.update` on that project creates the
   task (via the real `createTask` action, so `project_tasks`/`audit_logs`/`project_activity` all get their
   normal rows) and marks the request `executed`.
4. `approveActionRequest` by a user who does *not* hold `projects.update` is rejected, even if the original
   proposal somehow claimed otherwise.
5. Calling `executeTool` with an unregistered tool name, or input that fails its Zod schema, never throws —
   always a clean `ActionResult`.
6. No existing Phase 001-012 behavior changes.

## Tests

- `lib/ai/tools/executor.test.ts` — unknown tool rejected; malformed input rejected; permission denial path;
  `CONFIRM_TO_ACT` always proposes rather than executing; auto-execute path for a hypothetical `READ_ONLY`/
  `AUTO_SAFE` agent + risk-0 tool; failed handler returns `ok:false` and writes `status:'failed'`, never
  `'executed'`.
- `lib/ai/tools/approval.test.ts` — approver-permission re-check; rejecting a proposal never executes; approving
  an already-decided request is a no-op error (idempotency); the approval action has no code path reachable
  from `executeTool` itself.
- `lib/ai/tools/projects.test.ts` — `projects.search` scoped to the caller's own company only; `projects.task.create`
  produces identical `project_tasks`/audit rows to calling `createTask` directly.
- Manual test steps (Tier 1, post-implementation):
  1. As a Viewer, attempt `projects.task.create` via a direct call — confirm denial.
  2. As a Founder/Director, propose the same action — confirm it lands as `proposed`, not `executed`.
  3. Approve it as that same user — confirm the task appears in the real project, with a normal audit trail,
     and the `ai_action_requests` row shows `executed` with `decided_by` set.
  4. Attempt to approve an already-executed request again — confirm a clean no-op rejection, not a second task.

## Open questions before implementation

1. **Tier 1 only, or Tier 1 + Tier 2 this pass?** (see above) — my recommendation is Tier 1 only for this pass,
   given the explicit "do not overbuild" instruction and that Tier 2 is a substantial, separable piece of UI/
   prompt work that doesn't block anything else from being built correctly later.
2. If Tier 2 is approved for this pass too: should the confirm/cancel action card replace the current plain-text
   Company Brain answer box, or sit alongside it as a visibly distinct "Command" mode the user opts into? My
   recommendation is a single input that auto-detects question vs. command (matching the prompt's own framing),
   but this changes the existing UI's behavior for every user, which is worth confirming explicitly.
