# 014 — Orex Intelligence (foundation pass)

## Files inspected

- `lib/ai/agents/registry.ts`, `lib/ai/tools/{types,registry,executor,authorization,approval,risk,projects,schemas}.ts`,
  `supabase/migrations/0032_ai_action_engine.sql`, `app/actions/agent-actions.ts` — the existing AI Action Engine
  (prompts/013), fully intact, being extended here rather than replaced.
- `lib/ai/gateway.ts`, `lib/ai/model-registry.ts`, `lib/ai/usage.ts`, `supabase/migrations/0011_ai_usage_events.sql`
  — the usage/cost accounting this pass must extend, per the explicit "reuse `ai_usage_events`, no duplicate
  accounting" instruction.
- `app/actions/knowledge.ts`, `lib/knowledge/types.ts`, `supabase/migrations/0013_knowledge_and_decisions.sql`,
  the full `app/(app)/[companySlug]/brain/**` route tree, `components/knowledge/AskCompanyBrainBox.tsx`.
- `lib/permissions/catalog.ts`, `lib/permissions/index.ts` — confirmed **no `agents.*` permission exists today**.
- `components/shell/Sidebar.tsx` — confirmed an **`Intelligence` nav group already exists** (Company Brain,
  Decisions, two "Soon" items).
- `components/ui/{Surface,Modal,Button,EmptyState}.tsx`, `components/knowledge/KnowledgeTable.tsx`,
  `components/team/InvitationsTable.tsx`, `components/projects/database/ProjectDatabase.tsx` — UI templates.
- Repo-wide grep confirmed **zero existing file/Storage upload infrastructure** (no bucket, no signed-upload
  action, no upload UI) — every existing "attachment"-like field is a validated external URL string.
- `app/actions/*.ts` full listing — no `sessions.ts`/`messages.ts`/`agents.ts` domain exists yet.

## What exists that must be preserved

Company Brain (`/brain/**` routes, `app/actions/knowledge.ts`, the knowledge domain model) is **not removed or
migrated** — the request is explicit that it becomes the memory subsystem underneath Orex Intelligence, and this
pass literally reuses its routes/actions/schema unchanged. The entire Tier-1/Tier-2 AI Action Engine
(`lib/ai/tools/*`, `ai_action_requests`, `executeTool`, `approveActionRequest`) is extended, never replaced —
`projects.search`/`projects.task.create` keep working exactly as they do today. `AskCompanyBrainBox.tsx`'s
question/command/confirm-card pattern is the template the new session-based chat reuses, not a competing design.

## Decisions

1. **Agent registry moves from static config to a database table** (`agents`), since enable/disable, modes, and
   budgets all require state that changes without a deploy. `lib/ai/agents/registry.ts`'s `getAgent()` becomes
   `async` (its one call site, `executor.ts`'s `executeTool`, is already `async` — a one-line ripple, not a
   breaking API for anything else). A migration seeds today's single `advisor` row so behavior is unchanged
   until you actually configure something new.
2. **`enabled` (boolean) and `mode` (enum) are both modeled, not merged**, matching the request's two separate
   sections literally: `enabled` is the record-level switch (what a per-agent Enable/Disable toggle flips);
   `mode` (`OFF | MANUAL | SCHEDULED | AUTO_SAFE`) governs *how* an enabled agent may run. Effective "can this
   agent run at all right now" = `enabled AND mode != 'OFF' AND NOT global_paused` (see #4) — computed at
   execution time in `executeTool`, never cached.
3. **Budget/cost rollups reuse `ai_usage_events`, with one additive change**: it gains a nullable `agent_id text`
   and a nullable `agent_run_id uuid` column (currently has neither — confirmed by inspection, so agent
   attribution literally cannot be computed from it today). `requestAI`'s params gain optional `agentId`/`runId`,
   threaded straight into `recordUsage`. Daily/monthly spend and run counts are `sum`/`count` queries over this
   same table grouped by `agent_id` — no second events table, no separate cost ledger.
4. **Global AI controls are per-company** (founder-confirmed: "Orextic and Orex Studios maintain separate
   management, don't mix both data") — `global_ai_controls` has one row per `company_id` (`company_id` unique
   not null), never a single organisation-wide row: `paused boolean`, `background_agents_enabled`,
   `scheduled_agents_enabled`, `auto_safe_actions_enabled`. A "Pause All Agents" button on Orextic's Control Room
   never touches Orex Studios' row. Checked alongside each agent's own `enabled`/`mode` in `executeTool`, keyed
   by the agent's `company_id`.
5. **Sessions always have one explicit `primary_agent_id` this pass.** The "Auto" selector and the Super Brain
   Orchestrator (choosing between multiple agents) are explicitly deferred per the request's own build order —
   an "Auto" option in the UI this pass simply resolves to a single configured default agent (`advisor`), with a
   code comment marking it as the exact seam the orchestrator replaces later. No multi-agent fan-out this pass.
6. **Reuses the existing `Intelligence` sidebar nav group** (already contains Company Brain/Decisions) rather
   than creating a second, overlapping "Orex Intelligence" top-level section — adds Chat/Agents/Sessions/Control
   Room entries alongside the existing two. Knowledge/Decisions keep their current URLs (`/brain/**`); nothing
   about their routes changes, only new sibling routes are added (`/intelligence/**` or `/brain/../` — exact
   path scheme is an open question below).
7. **Attachments — split into two tiers, since real file/Storage upload is 100% new infrastructure (confirmed by
   inspection: no bucket, no upload action, nothing to extend) while reference-type attachments need none of
   that:**
   - **Tier A (this pass):** the full `agent_attachments` data model (all attachment types representable), and
     the **reference-type** attachments implemented end to end — Attach Project / Attach Knowledge / Attach
     Decision / Attach Previous Session all just point at an existing record by id, inheriting its own
     permission/classification rules (no new upload surface, no new privacy question).
   - **Tier B (explicitly NOT this pass, flagged for a follow-up scoping prompt):** actual binary
     image/PDF/audio upload — needs a new Supabase Storage bucket, a signed-upload-url server action, upload UI,
     a content-safety/classification step, a new vision-capable model alias, and (for voice) a speech-to-text
     integration. This is a real, separate infrastructure decision (retention policy, cost, safety review) that
     deserves its own prompt rather than being decided as a side effect of the agent-registry work. This pass
     builds the schema columns to receive it (`storage_path`, `transcript`, etc., all nullable) so Tier B is
     additive later, never a migration rewrite.
8. **New permissions**: `agents.read`, `agents.use`, `agents.manage`, `agents.enable`, `agents.approve` added to
   `lib/permissions/catalog.ts` + seeded in a migration (paired with the existing `0002_roles_permissions.sql`
   seed pattern) — per the request's explicit list. `agents.manage` gates enable/disable/mode/budget edits;
   `agents.use` gates starting a session/sending a chat message; `agents.read` gates viewing Control Room/run
   history; `agents.approve` is reserved for a future distinct-approver flow (mirrors `ai.approve`'s current
   unused-reservation status from prompts/013).
9. **Chat never bypasses data permissions** — this was already true (every tool call re-checks the real
   permission system) and stays true: a session's messages/attachments are scoped by the session's own
   `company_id`, and any Company Brain retrieval or tool call inside a session still goes through the identical
   `hasPermission`/`hasProjectAccess` checks as today. No new "chat-scoped" permission bypass is introduced.

## Architecture

```
supabase/migrations/0033_orex_intelligence.sql
  agents                  (replaces static AGENT_REGISTRY; seeded with today's "advisor" row)
  agent_budgets           (1:1 with agents -- daily/monthly budget, max daily runs, max context tokens)
  agent_runs              (one row per invocation; status enum matches the request exactly)
  agent_sessions          (the "Sessions" concept)
  agent_messages          (persistent chat history)
  agent_attachments       (Tier A: reference-type populated; Tier B columns present but unused)
  global_ai_controls      (singleton row)
  alter table ai_usage_events add column agent_id text, add column agent_run_id uuid

lib/ai/agents/
  registry.ts        getAgent() becomes async (DB-backed), getAgentByKey(), listAgents()
  budgets.ts         checkBudgetRemaining(agentId) -- queries ai_usage_events, never a separate ledger

app/actions/
  agents.ts          listAgents, getAgent, setAgentEnabled, setAgentMode, updateAgentBudget (all agents.manage)
  sessions.ts        createSession, listSessions, renameSession, archiveSession, getSession
  messages.ts        sendMessage (persists user message, invokes the agent, persists assistant message +
                     any action-proposal/tool-result exactly like agent-actions.ts's existing result shapes),
                     listMessages
  attachments.ts     attachProjectReference, attachKnowledgeReference, attachDecisionReference,
                     attachSessionReference (Tier A only)

app/(app)/[companySlug]/intelligence/
  chat/page.tsx            new session-based chat (extends AskCompanyBrainBox's pattern to a persisted session)
  chat/[sessionId]/page.tsx
  agents/page.tsx          agent list (Control Room entry point)
  agents/[agentKey]/page.tsx   Overview/Chat/Runs/Actions/Settings tabs
  sessions/page.tsx        session history list (rename/archive/search/resume)
  control-room/page.tsx    aggregate counts + agent cards (per request's exact fields)
```

### `agents` table (core columns)

```
id, agent_key text unique, name, description,
enabled boolean not null default true,
mode text not null default 'MANUAL' check in ('OFF','MANUAL','SCHEDULED','AUTO_SAFE'),
autonomy_mode text not null check in ('READ_ONLY','SUGGEST_ONLY','CONFIRM_TO_ACT','AUTO_SAFE'),
allowed_tools text[] not null default '{}',
max_risk_level smallint not null check between 0 and 3,
default_model_alias text not null,  -- validated against TaskAlias in app code, not a DB fk
organisation_id, company_id nullable,  -- null = org-wide agent
created_by, created_at, updated_at
```
(`mode` and `autonomy_mode` are deliberately distinct: `mode` is the request's OFF/MANUAL/SCHEDULED/AUTO_SAFE
run-trigger gate; `autonomy_mode` is the existing prompts/013 execute-vs-propose policy. An `AUTO_SAFE` *mode*
agent still has its own `autonomy_mode`, which still governs whether any given tool call executes or proposes —
the two are orthogonal, not duplicates.)

### `executeTool`'s new gate (added before today's existing checks, nothing removed)

```
const globalControls = await getGlobalAIControls();
if (globalControls.paused) return { ok: false, error: "AI is currently paused." };

const agent = await getAgent(agentId);           // now async
if (!agent || !agent.enabled || agent.mode === "OFF") {
  return { ok: false, error: "This agent is disabled." };
}
if (agent.mode === "SCHEDULED" && invocationSource !== "schedule") {
  return { ok: false, error: "This agent only runs on its configured schedule." }; // schedules themselves are deferred; this gate exists so MANUAL/chat invocation of a SCHEDULED-mode agent fails closed rather than silently running
}
const budgetOk = await checkBudgetRemaining(agent.id);
if (!budgetOk) return { ok: false, error: "This agent has reached its budget for this period." };
```
(Existing `allowedTools`/`maxRiskLevel`/autonomy-mode checks run unchanged after this.)

### Sessions / messages / cost control

`agent_sessions` matches the request's exact field list. `agent_messages` stores `role`, `content`, and a
`metadata jsonb` (`agentId`, `modelAlias`, `usageEventId`, `evidence`, `toolReference`, `approvalReference` —
informational only, never authoritative for permission decisions). Context sent to the model per turn = recent
N messages + a rolling summary (a new `summary` text column on `agent_sessions`, regenerated via one extra
cheap-alias model call once message count crosses a threshold — reuses `ops.fast`, never a new alias) + Company
Brain retrieval (unchanged) — never the full history resent every turn.

## Security implications

- Every new table gets RLS: `agent_sessions`/`agent_messages`/`agent_attachments` scoped by `has_company_permission(company_id, 'ai.use')` (or org-level for company_id null) for select, `created_by = auth.uid()` OR the same permission for the owning session's writes — mirrors the `ai_action_requests` no-client-write-except-through-service-role pattern for anything that must stay server-authoritative (run status transitions, budget checks).
- `agents`/`agent_budgets`/`global_ai_controls` writes require `agents.manage` (checked server-side in `app/actions/agents.ts`, RLS as a second layer) — a Viewer cannot enable/disable or reconfigure an agent even if they could otherwise guess a route.
- Disabling an agent takes effect on its **next** `executeTool` call — an already-in-flight execution is never killed mid-transaction (per the request's explicit instruction); a currently-executing run instead gets `disable_after_current_run` semantics via a boolean flag checked only when the *next* invocation attempt is made, not by aborting the current one.
- Cross-company session access denied by the same RLS pattern every other company-scoped table already uses — no new authorization primitive invented.
- Chat/session code never gains its own data-fetching path around the permission system — Company Brain retrieval and any tool call inside a session go through the exact same `hasPermission`/`retrieveKnowledge`/`executeTool` calls as today, so "show company finances" without `finance.read` is denied for exactly the same reason it would be denied outside chat (no finance tool exists yet regardless).
- Voice/image Tier B is deferred specifically because "attachments inherit actor/company/classification/session, secret content must never reach a normal provider" is a real, non-trivial policy surface that deserves its own review once there's an actual upload pipeline to review.

## Acceptance criteria

Matches the request's own "TESTS" section directly — see Tests below, each acceptance criterion is one of those.

## Tests

Every item from the request's "TESTS" section, mapped to a concrete test:
- `lib/ai/agents/registry.test.ts` — disabled agent cannot execute (`executeTool` returns `ok:false`, never calls
  the tool handler); re-enabled agent works again; `mode: 'OFF'` blocks execution identically to `enabled:false`;
  agent budget exhaustion stops new runs (mock `ai_usage_events` sum at/over the configured daily budget).
- `lib/ai/agents/budgets.test.ts` — budget check reads real `ai_usage_events` aggregates, never a separate
  counter that could drift.
- `app/actions/sessions.test.ts` — normal manual chat persists a message row; session survives being re-fetched
  (simulating "page refresh"); session remains company-scoped (cross-company fetch denied); a Viewer without
  `agents.use` cannot create a session; agent management actions require `agents.manage`.
- `app/actions/agents.test.ts` — Viewer cannot enable/disable/reconfigure an agent; `agents.manage` required.
- `lib/ai/tools/executor.test.ts` (extended) — global pause blocks every agent regardless of individual
  enabled/mode state; a `SCHEDULED`-mode agent invoked manually (not via a schedule) is refused.
- `app/actions/attachments.test.ts` — a reference attachment (e.g. Attach Project) inherits the referenced
  record's own permission check, never a separate weaker one; private-profile data is never attachable; a
  secret-classified record cannot be attached (fails closed, matching existing knowledge-classification rules).
- Manual test steps: disable an agent mid-session, confirm the next message in that session is refused but
  history is intact; re-enable, confirm it resumes; refresh the browser on an open session and confirm the
  conversation reloads from persisted messages, not local state.

## Decisions confirmed by the founder (previously open questions)

1. **Global AI controls are per-company** (Decisions #4) — not an org-wide singleton.
2. **URL scheme**: new `/[companySlug]/intelligence/**` routes; `/brain/**` stays exactly where it is, untouched.
3. **Attachments**: Tier A only this pass (reference-type: Attach Project/Knowledge/Decision/Session). Real
   binary upload is deferred — and specifically, a founder suggestion to back uploads with Google Drive/Notion
   (via the connectors already available in this environment) as a "system data backup" strategy is being
   treated as its own, separate future initiative, not folded into this pass: it raises genuinely different
   questions (per-company auth scoping to a third-party account, retention, classification enforcement outside
   Supabase) that deserve their own scoping prompt rather than a decision made as a side effect of the agent
   registry work.

## Scope explicitly excluded from this pass (per the request's own build order)

Orchestrator/"Auto" multi-agent routing, schedules, event triggers, Intelligence Inbox, Goal Mode, real binary
file/image/voice upload (Tier B above), any new domain agent beyond the existing `advisor` (Project/Operations/
Knowledge/Risk agents are configuration entries you can add later with zero architecture change, per the
registry design above — not implemented as distinct behaviors this pass).
