# 015 — Orex Intelligence: Visual & Interaction Redesign

## Status: IMPLEMENTED — code, security hardening, and session privacy separation complete and committed (`5affc8f`, pushed to `origin/main`). Interactive browser acceptance pending the founder's own click-through.

All code, tests, and two rounds of security hardening are complete. The founder re-enabled `advisor` (MANUAL mode) themselves via the live Agents page, confirmed by a real, correctly-attributed `agent.mode_changed` audit row. A live RLS impersonation test (real database, temporary fixtures created and fully cleaned up) confirmed: session creators can read their own conversations, a same-company user holding only `agents.read` cannot read another user's conversation, the founder's new `agents.audit_sessions` permission correctly grants elevated read access, and cross-company access is denied regardless of role name. No actual browser walkthrough as an authenticated user was performed by the assistant (no browser access in this environment) — that step is the founder's own next action.

### Round 3 — session privacy separation (2026-09-07)

`agent_sessions`/`agent_messages`/`agent_attachments` SELECT policies previously granted read access to anyone holding `agents.read` for the company — broad by design for agent *operational* visibility, but that also meant any Member/Contractor with `agents.read` could read another employee's raw conversation content. Fixed: a new, explicitly-granted permission `agents.audit_sessions` (migration `0035_session_privacy_separation.sql`) now gates reading *other* users' sessions/messages/attachments; a session's own creator can always read their own. Granted only to Founder today (least privilege by default — Director/Manager were deliberately left out pending an explicit product decision). `agents`, `agent_budgets`, `agent_runs`, `global_ai_controls` SELECT policies are untouched — operational visibility (availability, config, run summaries, cost) stays on `agents.read`.

Also fixed in this round: `setAgentEnabled`/`setAgentMode` previously recorded `before_state: null` in their audit log entries (live-confirmed via a real audit row) — both now select the agent's current `enabled`/`mode` before writing and record the real before/after state.

**Known, disclosed, not-yet-fixed finding**: a company-scoped member with no organisation-level role cannot see the org-wide `advisor` agent row at all (`agents_select`'s org-wide branch requires `has_org_permission`), which would make Orex Intelligence unusable for that user (`getAgent` returns null → "That agent does not exist"). Not exploitable today since all three real accounts hold organisation-level roles, but worth a deliberate decision before a real company-only Member is added.

## Files inspected

- `components/shell/Sidebar.tsx` — nav is data-driven (`buildNav`), Intelligence group currently has 4 separate items (Chat, Agents, Sessions, Control Room) plus Company Brain/Decisions/Opportunities/Reports (latter two have no `href`, render disabled).
- `app/(app)/[companySlug]/page.tsx` — Today Dashboard's hero: no breadcrumb, custom `<section>` with `radial-gradient(... var(--accent-dim) ...)` over `linear-gradient(--surface-2 → --surface-1)`, `rounded-[var(--radius-l)] border-[var(--border-subtle)]`, `font-display` (Fraunces serif) for headline, `ox-pill-neutral` badges below. No image asset anywhere in the repo — hero is pure CSS gradient.
- `app/(app)/[companySlug]/projects/page.tsx`, project detail page — standard sub-page pattern: `PageHeader` (title/description/action, no breadcrumb, no hero) → `Card`-wrapped content. `.ox-table`, `StatusBadge`/`HealthBadge`, `ox-pill` + tone classes.
- `components/ui/Surface.tsx` (`Card`, `CardHeader`, `PageHeader`), `components/ui/Button.tsx` (`primary|secondary|ghost|danger`, `md|sm`), `components/ui/EmptyState.tsx`, `components/ui/icons.tsx` (outline set, 1.6 stroke; **no send/mic/attach icon exists yet** — must author 3 new icons in the same pattern).
- `app/globals.css` — full token set (`--surface-*`, `--border-*`, `--text-*`, `--radius-*`, `--success/warning/danger/info`). **Important correction to the request**: there is no app-wide orange `--accent` — orange (`--company-orextic`) is a company-scoped accent only, per design-system convention ("never a full-page reskin"). The redesign will use the existing accent system (silver `--accent` app default, orange only where a company-scoped active/selected state already appears elsewhere), not invent a new global orange.
- `components/intelligence/*` (existing, this session): `AgentCard.tsx`, `ChatSessionView.tsx`, `GlobalControlsPanel.tsx`, `NewChatForm.tsx`, `SessionListLinks.tsx`, `SessionTable.tsx`. Routes: `agents/`, `chat/`, `chat/[sessionId]/`, `sessions/`, `control-room/` under `intelligence/`. All currently plain `PageHeader`+`Card`, no hero, chat has no attach/mic affordance.
- Backend (prompt 014, already built and unaffected by this pass): `agents`, `agent_budgets`, `global_ai_controls`, `agent_sessions`, `agent_messages`, `agent_attachments` (Tier A only), `executeTool` gating, `app/actions/{agents,sessions,messages,attachments}.ts`.

## Decisions

1. **Sidebar**: collapse the 4 Intelligence items into **1** — "Orex Intelligence" → `/${slug}/intelligence` (a new landing/chat route). Company Brain, Decisions, Opportunities, Reports stay exactly as-is (unchanged hrefs, unchanged disabled state for Opportunities/Reports). Agents and Control Room move to a secondary "Manage Agents" surface reached *from inside* Orex Intelligence (a drawer/link), not from the main sidebar. Sessions stops being a standalone nav item — history becomes an in-page drawer.
2. **Hero**: reuse the Dashboard's exact hero pattern (same gradient formula, same `font-display` treatment, same container), swapping only content — no breadcrumb (matches Dashboard precedent, not Projects' `PageHeader` precedent, since this is a top-level landing surface like Today). Compact right-side controls (Agent selector, Company indicator, AI status, spend, settings) sit inline in the hero's header row, styled as small `ox-pill`/ghost-button elements — not new large cards.
3. **Accent color**: use existing tokens as-is (`--accent`/`--accent-dim` for the hero gradient and primary actions, `--success/--warning/--danger/--info` for state, company-scoped orange only where the app already shows a company badge). I will not introduce a page-wide orange scheme, correcting that part of the request to match the real design system.
4. **New icons required**: `IconSend`, `IconMic`, `IconAttach` — authored in `components/ui/icons.tsx` following the existing `Base` SVG helper (24 viewBox, 1.6 stroke, currentColor), sized to match the existing set.
5. **Chat data model**: no backend changes. `sendMessage`/`listMessages`/`createSession`/`listSessions`/`archiveSession` (prompt 014) are reused verbatim. "Auto-create session on first message" is a **UI-only** change to `chat/page.tsx`: today it presumably requires picking an agent/session first — new flow calls `createSession` with a derived title (first ~40 chars of the message) transparently on first send, then redirects to `chat/[sessionId]`, no form/modal.
6. **Agent selector "AUTO"**: since only one agent (`advisor`) currently exists, "AUTO" in the UI resolves to `advisor` today — I will build the selector to *look* like the final spec (AUTO / named agents / disabled agents greyed out) but it is cosmetically ready for multi-agent, not functionally routing between agents yet (there's nothing to route between). This will be stated plainly in the report, not implied as "AUTO routing" being new functionality.
7. **Right context panel**: 3 blocks max, per the request — Current Context (company/projects/brain counts, reusing the existing `getControlRoomSummary`-style counts already computed for Control Room), Active Agents (the existing `AgentCard`-derived enabled list, compact), Suggested Actions (a static curated list of 4 prompts that populate the composer on click — no new AI-generated "suggestions" backend).
8. **Action cards inside chat**: the existing `pendingAction`/Confirm/Cancel block in `ChatSessionView.tsx` is restyled into the requested structured card (agent badge, risk pill, permission line, Confirm/Edit/Cancel) but is **not** given new capabilities — "Edit" will be included only if trivial (re-populates composer with a rephrase prompt); if not trivial within this pass it will be a disabled/omitted button and disclosed as deferred rather than half-built.
9. **Attachments**: composer gets a `+` menu exposing exactly what's implemented today — Attach Project / Attach Company Brain record / Attach Decision / Attach Session (Tier A, from `app/actions/attachments.ts`). Upload image/PDF/document menu entries are shown **disabled** with "Coming soon" (Tier B, already deferred in prompt 014) — not hidden, so the eventual feature has a visible home, but not clickable.
10. **Voice**: mic icon shown in composer, disabled/tooltip "Coming soon" — no transcription backend exists. Not a functional build this pass, per prompt 014's Tier B deferral; showing it non-functionally would misrepresent capability, so it will be visually present but disabled with a tooltip, matching the attach-menu treatment.
11. **Manage Agents surface**: becomes a right-hand drawer (or `/intelligence/agents` route kept as the "advanced" destination, linked via a "Manage Agents" button) reusing the existing `AgentCard`/`GlobalControlsPanel`/Control Room stat tiles verbatim — no new agent-management logic, only relocated/reframed as secondary.
12. **Responsive**: right panel collapses behind a "Context" toggle button below desktop width; history collapses behind a "History" toggle on mobile. No new breakpoints beyond Tailwind defaults already used elsewhere in the app.

## Architecture (files to add/change)

New:
- `components/intelligence/IntelligenceHero.tsx` — header/hero, reusing Dashboard's gradient markup.
- `components/intelligence/AgentSelector.tsx` — dropdown (AUTO + advisor, others greyed "Disabled" if `enabled=false`), reads `listAgents`.
- `components/intelligence/ConversationHistoryDrawer.tsx` — replaces `sessions/page.tsx` as primary UX; groups by Today/Yesterday/Previous 7 days from `created_at`/`last_message_at`; rename/archive inline (reuses existing `renameSession`/`archiveSession` actions).
- `components/intelligence/CurrentContextPanel.tsx`, `ActiveAgentsPanel.tsx`, `SuggestedActionsPanel.tsx` — the 3 right-column blocks.
- `components/intelligence/Composer.tsx` — extracted from `ChatSessionView`, adds `+` attach menu (wired to existing `attachReference`), disabled mic button, disabled unfinished-upload menu entries.
- `components/intelligence/ActionProposalCard.tsx` — extracted/restyled version of the existing inline pendingAction block.
- 3 new icons in `components/ui/icons.tsx`.

Changed:
- `components/shell/Sidebar.tsx` — collapse Intelligence group to one entry (`Orex Intelligence` → `/${slug}/intelligence`); Company Brain/Decisions untouched.
- `app/(app)/[companySlug]/intelligence/page.tsx` (NEW landing, replaces the old `chat/page.tsx` as the default entry) — hero + empty-state composer + suggested prompts; auto-creates a session on first send and redirects to `chat/[sessionId]`.
- `app/(app)/[companySlug]/intelligence/chat/[sessionId]/page.tsx` — restyled shell (hero-less, but same header pattern), wires `ConversationHistoryDrawer`, `AgentSelector` (display-only), the 3-panel right column, `Composer`, `ActionProposalCard`.
- `components/intelligence/ChatSessionView.tsx` — visual restyle only (message rows per spec: `YOU`/`OREX` small-caps label + timestamp instead of bubbles), same data flow, extracted Composer/ActionProposalCard.
- `app/(app)/[companySlug]/intelligence/agents/page.tsx`, `control-room/page.tsx` — kept as routes (the "Manage Agents"/advanced destination), linked from the Intelligence page rather than the sidebar; `sessions/page.tsx` removed in favor of the in-page drawer (or kept as a thin redirect to avoid dead links from bookmarks — will keep as redirect for safety).

No new tables, no new server actions beyond what 014 already created, no new permissions.

## Security implications

None — no new data access paths, no new mutation paths, no permission changes. Every action card / attach / manage-agents control continues to call the exact same gated server actions from prompt 014. Purely a client-side/presentation restructuring plus 3 new decorative icons and one thin redirect.

## Acceptance criteria

- Sidebar shows one "Orex Intelligence" entry; Company Brain/Decisions/Opportunities/Reports unchanged.
- `/intelligence` shows hero + empty composer + suggested prompts when no active session; first message auto-creates a session (no title form) and lands on `/intelligence/chat/[id]`.
- Reopening a past session from the history drawer restores its messages.
- Agent selector displays AUTO + advisor; a manually-disabled agent (toggle off via Manage Agents) shows as "Disabled" in the selector and cannot be selected.
- Composer's `+` menu can attach a project/knowledge/decision/session reference (existing Tier A flow); image/PDF/voice controls render visibly disabled, never silently missing.
- Pending action proposals render as a structured card (agent, target, risk, Confirm/Cancel) and behave identically to today (approve/reject through `decideAgentAction`).
- Manage Agents / Control Room reachable from Orex Intelligence, functionally unchanged.
- Disabling an agent via Manage Agents still blocks `executeTool` (unchanged backend, re-verified by existing tests).
- Mobile: right panel and history both collapse behind toggle buttons; no horizontal scroll.

## Tests

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (no server-action tests change, but component-level behavior — auto-session-creation — gets a new test in the sessions/messages action layer only if the auto-create logic moves server-side; if it stays client-orchestrated calling existing actions, no new unit tests are needed beyond what 014 already has), `npm run build`.
- Manual: create first message with no existing sessions (auto session + title), reopen via history drawer, disable an agent and confirm selector reflects it and `executeTool` still refuses, mobile viewport check, client-bundle secret scan (should be unaffected, but re-run for safety since it's a habit, not because this pass touches secrets).

## Manual test steps

1. Log in as founder, open `/intelligence` — verify hero, empty composer, suggested prompts, no title/session form.
2. Send "What needs my attention?" — verify a session is created silently, redirected to `/intelligence/chat/[id]`, title auto-derived.
3. Open history drawer — verify the new session appears under Today, click it, verify messages persist.
4. Trigger an action-requiring command (reuse an existing AI Action Engine test case from prompt 013) — verify the new card styling still lets you Confirm/Cancel and the outcome matches previous behavior.
5. Go to Manage Agents, disable `advisor`, return to `/intelligence` — verify selector shows it disabled and sending a message now fails with the existing "Agent is disabled" safe error, not a crash.
6. Resize to mobile width — verify right panel/history are both reachable via toggle, no broken layout.

---

Requesting approval to implement this vertical slice (sidebar collapse + hero + composer/history/context-panel restyle + 3 new icons + Manage Agents relocation), with the two corrections noted above (no app-wide orange reskin; AUTO is cosmetic until a second agent exists) — no backend/schema/permission changes. On approval I will implement, run the full check suite, and report using the requested `# OREX INTELLIGENCE REDESIGN` format, then stop.

## Approved amendments (founder, 2026-09-06)

Approved with 27 numbered adjustments, folded into the implementation as follows:

- **No fabricated agents**: the selector renders only rows from `listAgents()` (today: Founder Advisor). AUTO is a real resolution function (`activeAgent` in `IntelligenceWorkspace`), not hard-coded text — adding a second `agents` row is the only change needed for it to route between more than one.
- **Chat dominates**: right context rail is collapsible (default open ≥1024px, hidden below), capped at 3 sections, no metric dashboard.
- **Real numbers only**: `lib/intelligence/context.ts` returns `null` (omitted by the panel) for any count the caller isn't authorized to see, never a placeholder.
- **Compact hero**: the workspace header is a single slim bar (History, Agent selector, Company pill, AI Active + spend, Context toggle) — not a Today-style banner.
- **No session-setup screen**: `createSession` is called invisibly from `IntelligenceWorkspace.ensureSession` on first send; the URL is replaced afterward via `router.replace`, never a form.
- **Deterministic titles**: `lib/intelligence/title.ts`'s `deriveSessionTitle` — no extra AI call spent on naming.
- **History drawer**: `ConversationHistoryDrawer` groups Today/Yesterday/Previous 7 Days/Older, supports search/rename/archive, never shows a raw id. `/intelligence/sessions` and `/intelligence/chat` kept only as redirects for old links/bookmarks.
- **Composer**: `+` menu offers the 4 real Tier A attach types (wired to `attachReference`/new `listAttachable`); Upload Image/PDF/File and the mic button render visibly disabled ("Coming soon") rather than hidden or faked.
- **Action cards**: `ActionProposalCard` shows only fields the Action Engine actually returns (agent, tool, summary, a risk label read from the tool's real registered `riskLevel` via a new `getToolRiskLabel` helper) — "Edit" is omitted, not stubbed, and disclosed as deferred.
- **Root cause fixed before polish**: `createSession`/`renameSession` were writing through the RLS-bound client against `agent_sessions`, which only carries a SELECT policy — every session creation failed with "Something went wrong." Fixed by moving those writes to the service-role client (mirroring `archiveSession`'s existing pattern), gated by the same `agents.use` permission check that was already there.

## Security hardening pass (2026-09-07)

Prompted by the founder's concern that `createServiceRoleClient()` bypasses RLS and could become an authorization bypass. Full audit performed; **two real findings, both fixed**:

1. **`archiveSession` had no authorization check at all beyond authentication.** It looked up the target session via the service-role client (bypassing RLS) and never verified the caller had any relationship to that session — any authenticated user in the system who knew or guessed a session UUID could archive (or unarchive) any session, including one in a different company. Fixed: `archiveSession` now does an RLS-gated `getSession()` read first, then a new `canMutateSession()` check.
2. **Read visibility was being treated as write authorization** in `renameSession`, `sendMessage`, and `attachReference`. `agent_sessions_select`'s RLS policy is deliberately broad — anyone holding `agents.read` for a company (which includes the Viewer role, confirmed live) can see conversation history for oversight. None of the three mutation actions checked anything beyond "can I see it," so any user with `agents.read` in a company could rename another user's conversation, post messages into it, or attach references to it. Fixed: added `canMutateSession(session, userId)` (creator OR `agents.manage`) and required it in all three.
3. **Scope gap (defensive fix, not yet exploitable)**: `createSession` resolved an agent by key without checking the agent's own `organisationId`/`companyId` against the session being created. Only safe today because the single seeded agent is org-wide; fixed proactively so the next company-scoped agent can't be reached through a session created for a different company.

New/updated tests: `sessions.test.ts` (+4, incl. two SECURITY-labeled tests proving the archive bypass is closed and the scope check works), `messages.test.ts` (+1), `attachments.test.ts` (+1). Full suite: 327/327 passing.

**Live-verified (read-only, real Supabase project `orex-os`)**:
- `pg_policies` confirms `agent_sessions`, `agent_messages`, `agent_attachments`, `agents`, `agent_budgets`, `global_ai_controls` carry **SELECT-only** RLS, no client INSERT/UPDATE/DELETE policy on any of them — matching migration 0033 exactly, so even a bug in application code could not turn into a direct-write bypass from the browser.
- `has_company_permission`/`has_org_permission` (migration 0006) are `security definer` SQL functions that resolve the acting user via `auth.uid()` internally — never a client-supplied user id — so a forged `companyId` in a request body only ever answers "does *this real session's* authenticated user have this permission for company X," which is false for a company the caller isn't a member of.
- `role_permissions` confirms Viewer holds `agents.read` only (not `agents.use`/`manage`) — this is what made finding #2 a real, exploitable gap rather than a theoretical one.
- **Blocking finding, unrelated to this prompt's code**: the live `advisor` agent's `mode` is currently `OFF` (confirmed via `audit_logs`: a real, authenticated `agent.mode_changed` action on 2026-09-06 17:11 UTC, not a bug or leftover test state). With the OFF-mode check added in prompt 015, this correctly blocks all session creation right now — which also means the live first-message walkthrough could not be completed this pass. Not changed unilaterally; flipping an agent's operational mode is an admin action for the founder, not something to do silently.

**Not performed (sandbox limitation, consistent with every prior phase)**: an actual browser-based click-through as a real authenticated user, and cross-user forgery tests requiring a second real login. Authorization for those scenarios was instead verified by direct code and live-RLS/live-permission-matrix inspection above, which is a stronger (server + database, not just one browser's behavior) guarantee than a single click-through would have provided anyway.
