# 016 — Orex Super Brain: Phase A (Core)

## Status: PLAN ONLY — architecture approval requested, no code written yet

This is a major architecture change (new execution lifecycle, new agents, an orchestrator). Per the project's working rules, this prompt documents the grounded plan and stops for approval before any implementation begins.

## Files inspected

- `lib/ai/gateway.ts`, `lib/ai/router.ts`, `lib/ai/client.ts`, `lib/ai/model-registry.ts` — the gateway is a single funnel (alias → route → OpenRouter → structured output → usage). **All 8 requested aliases already exist** (`advisor.deep`, `ops.fast`, `finance.structured`, `risk.deep`, `meeting.research`, `builder.long`, `knowledge.extract`, `agent.tools`) — no new alias needed for Phase A.
- `lib/ai/tools/{types,registry,authorization,risk,executor}.ts`, `lib/ai/tools/projects.ts` — the Action Engine. Confirmed the executor's exact gate order (agent enabled/mode → allowed_tools → risk ceiling → input schema → auth → scope → global pause → budget → autonomy decision) and `isExecutionAllowed`'s table (read above). **Only 3 tools are registered today**: `projects.search` (risk 0), `projects.task.create` (risk 1), `projects.tasks.create_batch` (risk 1, added this session).
- `lib/ai/agents/{registry,budgets,global-controls}.ts` — DB-backed (migration 0033). `getAgent`/`listAgents` are async, already used by `executeTool`. Only one row exists today: `advisor` (org-wide, `enabled=true`, `mode=MANUAL`, `autonomyMode=CONFIRM_TO_ACT`, `maxRiskLevel=1`, `allowedTools=[projects.search, projects.task.create, projects.tasks.create_batch]`).
- `app/actions/{sessions,messages,agent-actions,attachments}.ts` — sessions/messages persistence, and the **critical finding**: `sendMessage` → `runCompanyBrainCommand` passes only `question: parsed.content` — **no prior message history is fetched or sent to the model today**. Every message is answered with zero conversation memory. This is not a Phase-A nice-to-have; it's a real gap Phase A's rolling-summary work must close.
- `supabase/migrations/0033_orex_intelligence.sql` — `agent_runs` table exists (id, agent_id, session_id, organisation_id, company_id, actor_user_id, goal, status enum exactly matching this prompt's list, model_alias, result jsonb, error_message, started_at, completed_at) with a SELECT-only RLS policy. **Nothing writes to it yet.** `getControlRoomSummary` (`app/actions/agents.ts`) uses `ai_action_requests` as a documented interim proxy for "waiting approval"/"failed" — Phase A is what finally makes `agent_runs` real.
- `lib/projects/{urgency,insights,readiness}.ts` — pure functions (`urgencyBadge`, `isUrgent`, `isNearDeadline`, `checkProjectReadiness`) that already compute exactly the kind of derived analysis "Project Agent"/"Operations Agent" need, operating on already-fetched rows. Reusable as-is; nothing here needs reinventing.
- `app/actions/project-{tasks,milestones,readiness-checks,deliverables}.ts` — existing CRUD actions with permission/scope checks already proven correct (creators of the tools I added this session reused these verbatim). No project data-read path exists yet as a *typed AI tool*, only as page-level server actions.
- `lib/knowledge/retrieval.ts` — `retrieveKnowledge` is the one reusable Company Brain search path; already used by both the UI and `runCompanyBrainCommand`.
- `lib/permissions/index.ts`, migrations `0006`, `0035`, `0036` — `has_company_permission`/`has_org_permission` resolve the actor via `auth.uid()` server-side (never client input); the org-wide-agent visibility fix (0036) and session-privacy separation (0035, `agents.audit_sessions`) are both live and must not regress.
- `components/intelligence/*`, `app/(app)/[companySlug]/intelligence/*` — the simplified UI (single sidebar entry, `IntelligenceWorkspace`, `AgentSelector`, `ContextRail`, `ActionProposalCard`) from prompt 015. Phase A is backend-only; no navigation or component redesign is proposed.

## Decisions requiring explicit confirmation

1. **"Multi-agent execution" is deterministic data-gathering + one synthesis call, not N independent chat completions.** Given "do not create one model call per task" and existing cost-control discipline, Project/Operations/Risk agents each contribute a **read-only, non-AI data-gathering step** (real queries + the existing pure urgency/readiness functions) run in parallel via `Promise.all`; Risk's step additionally makes its own lightweight AI call (`risk.deep`) to turn raw findings into probability/impact/confidence, since that's genuinely an interpretive task the other two aren't. A single final synthesis call (`advisor.deep`) combines everything into the one coherent response the spec's examples show. Each contributing agent still gets its own `agent_runs` row (for enable/disable, budget, and audit purposes) even when its own step made no model call. **I'm flagging this as a specific design choice, not assuming it** — the alternative (one full chat completion per selected agent, running in parallel) is more literally "each agent reasons independently" but multiplies cost 2-4x per AUTO request for no clear accuracy gain at this stage, given all four Phase A agents are read/analysis-only, not adversarial reasoners who need independent framing.
2. **Batch task risk level.** Per this prompt's #38, `projects.tasks.create_batch`'s risk level moves from 1 → **2** (a schema/registry change, not a migration — risk level lives in `ToolDefinition`, in code). Direct consequence: the `advisor` agent's `maxRiskLevel` (currently 1) must also rise to 2, or the executor refuses the tool outright (`tool.riskLevel > agent.maxRiskLevel`) instead of proposing it — confirmed via `lib/ai/tools/risk.ts`: under `CONFIRM_TO_ACT`, risk 2 always returns `"propose"`, never `"execute"`, so raising the ceiling does **not** grant auto-execution, only permission to propose. `AUTO_SAFE` agents also always propose at risk 2 (only risk 0-1 auto-executes there) — matches #38's "AUTO_SAFE must never execute a batch task creation without approval."
3. **New agents are real DB rows, not orchestrator-internal concepts.** `Project Agent`, `Operations Agent`, `Knowledge Agent`, `Risk & Opportunity Agent` are seeded into `agents` (org-wide, `mode=MANUAL`, `autonomyMode=CONFIRM_TO_ACT`, `maxRiskLevel` per table below) so they inherit enable/disable, budgets, and audit for free from the existing architecture — never a parallel "agent" concept living only in application code.
4. **AUTO's routing call is one new structured-output request per user message** (alias `ops.fast`, schema `{intent, domains[], agentKeys[], requiresKnowledge, requiresTools, confidence}` per this prompt's §19), server-validated against real enabled agents/permissions before anything runs — the model *proposes* routing, the server is authoritative, per §19's own instruction.
5. **Rolling summary trigger**: regenerate `agent_sessions.summary` when the session's message count crosses a threshold (proposed: every 12 messages, i.e. ~6 exchanges) via one `ops.fast` call. Below that threshold, full recent history is sent as-is (bounded, since sessions are short-lived by nature); above it, context = summary + last 6 messages + fresh retrieval. Exact threshold is a tuning knob, not an architectural commitment — flagging the number specifically so it's an explicit, changeable choice rather than a buried constant.

## Architecture

### 1. Agent run lifecycle (`agent_runs` becomes authoritative)

New `lib/ai/agents/runner.ts`, exporting `runAgent(params)`:

```
runAgent({ actorUserId, organisationId, companyId, sessionId, agentKey, goal, execute })
  → resolve agent (enabled/mode/company-scope — same checks executeTool already has)
  → check global AI controls (existing getGlobalAIControls)
  → check budget (existing checkBudgetRemaining)
  → insert agent_runs row (status: "queued" → "planning")
  → status: "executing"; run `execute(runContext)` — the caller's actual work
    (a data-gather function, an AI call, or a tool proposal)
  → on success: status "completed", result summary (counts/refs, never raw
    chain-of-thought), usage/cost pulled from any ai_usage_events rows this
    run's AI calls produced (agent_id/agent_run_id already exist on that
    table — no duplicate ledger)
  → on tool proposal: status "waiting_approval"; resolved to "completed" or
    "partial" when approveActionRequest/rejectActionRequest later fires
    (new: agent_run_id column already exists on ai_action_requests? — NO,
    it does not; Phase A adds a nullable agent_run_id FK to
    ai_action_requests so an approval later on can close the run it belongs
    to)
  → on failure: status "failed", error_message via toSafeAIErrorMessage
    (never a raw stack trace)
```

`executeTool` and `runCompanyBrainCommand` are refactored to call through `runAgent` rather than being called directly — this is the "canonical execution layer" §12 asks for. No existing caller's *behavior* changes; the wrapper adds a row and cost attribution, it doesn't add new gates beyond what `executeTool` already enforces (no duplicated authorization logic — `runAgent` calls the existing `executeTool`/`requestAI`, it doesn't reimplement their checks).

### 2. New tools (all Level 0, read-only, wrapping existing server actions — no new business logic)

| Tool | Wraps | Scope |
|---|---|---|
| `projects.get` | project detail: row + milestones + tasks + deliverables + readiness checks (existing queries, assembled) | project |
| `projects.list_at_risk` | `projects.search`'s existing query + `urgencyBadge`/`isNearDeadline`/`checkProjectReadiness` applied server-side | company |

Two tools, not ten — Project Agent and Operations Agent both read through these; Operations Agent's "today/deadlines/blockers" framing is a different *prompt*, not a different *tool*. Knowledge Agent uses the existing `retrieveKnowledge` directly (already a reusable function, doesn't need a tool wrapper since it's never called by the model, only by server code). Risk Agent consumes `projects.list_at_risk`'s output as its evidence, adding its own AI interpretation pass on top.

### 3. New agents (migration, seeded rows)

| agent_key | name | allowed_tools | max_risk_level | autonomy_mode |
|---|---|---|---|---|
| `project_agent` | Project Agent | `projects.search`, `projects.get`, `projects.list_at_risk`, `projects.task.create`, `projects.tasks.create_batch` | 2 | CONFIRM_TO_ACT |
| `operations_agent` | Operations Agent | `projects.list_at_risk`, `projects.get` | 0 | READ_ONLY |
| `knowledge_agent` | Knowledge Agent | (none — uses `retrieveKnowledge` directly, not the tool-call path) | 0 | READ_ONLY |
| `risk_agent` | Risk & Opportunity Agent | `projects.list_at_risk`, `projects.get` | 0 | READ_ONLY |

`advisor`'s `max_risk_level` rises 1 → 2 (Decision #2). All four new rows are **enabled=true, mode=MANUAL** by default, matching "Founder Advisor: enabled/MANUAL" precedent — the founder can disable any of them immediately from the existing Manage Agents page with zero code change, per §8.

### 4. AUTO Orchestrator

New `app/actions/orchestrator.ts` (or a new `lib/ai/orchestrator/` module — naming TBD at implementation time), replacing `IntelligenceWorkspace`'s current hard-coded "advisor" session agent when the user has selected AUTO (the UI's AUTO option already exists — prompt 015 — today it always resolves to `advisor`; this is where it stops being cosmetic):

```
1. Bare-greeting short circuit (existing isBareGreeting check, unchanged, zero cost).
2. Classify: one ops.fast structured-output call → {intent, domains, agentKeys, requiresKnowledge, requiresTools, confidence}.
3. Server validates every agentKey the model proposed: exists, enabled, mode != OFF,
   company-scoped correctly (reuses the 0036 org-wide-visibility logic), actor holds
   agents.use for this company, budget not exhausted. Silently drop any agentKey that
   fails a check (never trust the model's list at face value) rather than fail the
   whole request — matches "partial failure, don't discard useful results" (§22).
4. If zero agents survive validation: fall back to `advisor` alone (never a hard error).
5. Run each surviving agent's read-only data-gather in parallel (Promise.all) via runAgent.
6. If intent is "act": resolve project via projects.search (unchanged from today),
   propose the mutation tool through executeTool exactly as today's single/batch flow does.
7. If intent is "ask"/"analyze"/"plan": one synthesis call (advisor.deep) combining every
   surviving agent's findings + Company Brain retrieval → the structured multi-section
   response shown in §21's example.
8. Persist the assistant message; update agent_sessions.summary if the rolling-summary
   threshold was crossed (Decision #5).
```

### 5. Rolling session context

`sendMessage` (currently stateless per-message) is extended to fetch: last N `agent_messages` rows + `agent_sessions.summary` (if present) + fresh `retrieveKnowledge` results, and pass all three into the orchestrator's context. A new lightweight summarizer (`ops.fast`, structured output: `{goal, facts[], decisions[], openItems[]}`) regenerates the summary when the threshold is crossed, folding the previous summary + the messages since it was last generated — never re-summarizing from scratch, never including secret-classified content in the summary (the same classification rules the context-builder already enforces apply here unchanged).

### 6. Control Room → real data

Once `runAgent` populates `agent_runs`, `getControlRoomSummary` switches its "waiting approval"/"failed"/"running" counts from the `ai_action_requests` proxy to real `agent_runs` aggregates (status counts, `SUM(estimated_cost)` already available via `ai_usage_events.agent_run_id`). No UI change — `ControlRoomPage`'s existing stat-tile grid just receives real numbers instead of the documented proxy.

## Security

- No new authorization primitive. `runAgent` calls existing `executeTool`/`getGlobalAIControls`/`checkBudgetRemaining`/permission functions — it does not reimplement any check.
- The orchestrator's model-proposed `agentKeys`/`domains` are **never** trusted directly — every agentKey is re-validated server-side against real `agents` rows and the actor's real permissions before anything runs (§19's "server policy remains authoritative").
- New read tools (`projects.get`, `projects.list_at_risk`) are Level 0, scoped exactly like `projects.search` today (company-scoped, RLS-backed via the normal client, never service-role for reads).
- `projects.tasks.create_batch`'s risk bump to 2 makes it **strictly harder** to auto-execute, never easier (Decision #2).
- Knowledge Agent never receives secret-classified content — reuses `retrieveKnowledge`'s existing classification filtering unchanged.
- Session privacy (0035) and org-wide agent scope (0036) are unmodified; Phase A's new agents inherit the same `agents_select`/`agent_sessions_select` policies already in place — no new RLS policy is needed for the 4 new agent rows themselves (they're just more rows in an already-correctly-policied table).
- Orchestrator never executes a mutation tool without going through the identical propose/approve path every tool already uses — no new execution shortcut for "AUTO."

## Session privacy

Unchanged. `agents.audit_sessions` (Founder only) still governs cross-user conversation read access; the new agents don't read raw conversations at all — they read Projects/Company Brain data, which has always had its own independent permission model.

## RLS

No new tables this phase (agent_runs already exists with correct RLS). One additive, backward-compatible column: `ai_action_requests.agent_run_id uuid null references agent_runs(id)` — existing SELECT policy on `ai_action_requests` is unaffected (it doesn't reference this column).

## Test plan

- Unit: `runAgent`'s state machine (queued→executing→completed/failed/waiting_approval), each existing gate (disabled/OFF/global-pause/budget) still refuses *before* a run row transitions past "queued".
- Unit: orchestrator's agentKey re-validation drops a disabled/unauthorized/wrong-scope agent silently rather than erroring the whole request (§22 partial failure).
- Unit: `projects.tasks.create_batch` at risk 2 always proposes under both CONFIRM_TO_ACT and AUTO_SAFE (never auto-executes) — extends existing `risk.test.ts`/`executor.test.ts` coverage.
- Unit: rolling summary regenerates only past the threshold; below it, full recent history is sent unchanged.
- Live/security (mirroring the pattern already used for 0035/0036 — temporary fixtures, cleaned up): cross-company agent denial for the 3 new company-visible-but-org-wide agents, cross-org denial, disabled-agent denial, OFF-mode denial, Viewer-without-agents.use denial, org-wide agent usable only through an authorized company (reusing the exact live-RLS technique already proven this session).
- Manual: AUTO test matrix from §96 ("Show active projects" → Project Agent only; "What needs my attention tomorrow" → Project + Operations, possibly Risk; "Hi" → zero agent run, zero cost).
- Full suite: `npm run typecheck && npm run lint && npm run test && npm run build`, client secret scan, migration verification, live RLS spot-checks.

## Migration plan

1. `0038_agent_run_lifecycle.sql` — `alter table ai_action_requests add column agent_run_id uuid references agent_runs(id)`.
2. `0039_phase_a_specialist_agents.sql` — seed `project_agent`/`operations_agent`/`knowledge_agent`/`risk_agent` rows; raise `advisor.max_risk_level` to 2.
3. Code: `projects.tasks.create_batch`'s `riskLevel` literal 1 → 2 in `lib/ai/tools/projects.ts` (not a migration — it's in the `ToolDefinition` object).

## Deferred (explicitly not this pass)

Phase B (multimodal/images/voice/files), Phase C (Goal Mode/schedules/automation engine), Phase D (Intelligence Inbox/Scenario Lab/Digital Twin/Daily Log/Weekly-Monthly review), Phase E (Client/Meeting/Finance/Performance/Growth agents — their underlying modules don't exist yet, so per §13 "do not fabricate tools for modules that do not exist" these are architecturally prepared for but not implemented), Phase F (Builder Studio/Connections/MCP). Also explicitly deferred within "Phase A" itself: `agent_run_id` back-reference is added to `ai_action_requests`, but no UI surfaces run detail pages yet (§76) — Control Room's existing summary tiles are the only consumer this pass.
