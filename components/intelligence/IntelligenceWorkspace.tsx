"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession } from "@/app/actions/sessions";
import { sendMessage, recordSystemMessage } from "@/app/actions/messages";
import { decideAgentAction, type CompanyBrainCommandResult } from "@/app/actions/agent-actions";
import { deriveSessionTitle } from "@/lib/intelligence/title";
import { AgentSelector, type SelectableAgent } from "./AgentSelector";
import { Composer, AttachmentChip, type PendingAttachment } from "./Composer";
import { ActionProposalCard } from "./ActionProposalCard";
import { ConversationHistoryDrawer, type HistorySessionRow } from "./ConversationHistoryDrawer";
import { ContextRail } from "./ContextRail";
import { IconHistory, IconSettings, IconSparkle } from "@/components/ui/icons";
import type { IntelligenceContextSummary } from "@/lib/intelligence/context";
import type { RecentActivityRow } from "@/app/actions/agents";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PendingActionState {
  requestId: string;
  agentName: string;
  toolName: string;
  summary: string;
  riskLabel: string | null;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * The single Orex Intelligence workspace shell -- landing (sessionId=null)
 * and an open conversation (sessionId set) share this exact component
 * (prompts/015): the first message auto-creates a session with no title
 * form (Decisions #10/#11), then the URL is replaced so history/bookmarks
 * work, without a full page reload or re-fetch of the messages already in
 * local state.
 */
export function IntelligenceWorkspace({
  companySlug,
  organisationId,
  companyId,
  companyName,
  sessionId: initialSessionId,
  initialMessages,
  agents,
  contextSummary,
  historySessions,
  spendToday,
  canManageAgents,
  recentActivity,
}: {
  companySlug: string;
  organisationId: string;
  companyId: string;
  companyName: string;
  sessionId: string | null;
  initialMessages: StoredMessage[];
  agents: SelectableAgent[];
  contextSummary: IntelligenceContextSummary;
  historySessions: HistorySessionRow[];
  spendToday: number;
  canManageAgents: boolean;
  recentActivity: RecentActivityRow[];
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<StoredMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  // Reconstructs an unresolved action proposal on reopen -- previously the
  // Confirm/Cancel card only existed for the live moment it was created;
  // refreshing or reopening the session left a proposed action with no way
  // to act on it (real bug: a 26-task batch import sat proposed forever).
  // Unresolved = the last message is the proposal itself, with nothing
  // (e.g. "Action confirmed."/"Action cancelled.") after it.
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(() => {
    const last = initialMessages[initialMessages.length - 1];
    if (!last || last.role !== "assistant" || last.metadata?.kind !== "action_proposed") return null;
    const requestId = last.metadata.requestId;
    const toolName = last.metadata.toolName;
    if (typeof requestId !== "string" || typeof toolName !== "string") return null;
    return {
      requestId,
      agentName: "Founder Advisor",
      toolName,
      summary: last.content,
      riskLabel: typeof last.metadata.riskLabel === "string" ? last.metadata.riskLabel : null,
    };
  });
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isDeciding, startDecideTransition] = useTransition();

  const activeAgent = agents.find((a) => (selectedAgentId ? a.agentId === selectedAgentId : a.enabled)) ?? agents[0];
  const agentDisplayName = activeAgent?.name ?? "Founder Advisor";

  function addLocal(role: StoredMessage["role"], content: string, metadata: Record<string, unknown> = {}) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content, metadata, created_at: new Date().toISOString() }]);
  }

  function summarize(result: CompanyBrainCommandResult): string {
    if (result.kind === "answer") return result.answer;
    if (result.kind === "needs_clarification") return result.question;
    if (result.kind === "action_proposed") return result.summary;
    return `Done — ${result.summary}`;
  }

  async function ensureSession(firstMessage: string): Promise<string | null> {
    if (sessionId) return sessionId;
    if (!activeAgent) {
      setError("No agent is available to start a conversation.");
      return null;
    }
    const created = await createSession({
      organisationId,
      companyId,
      title: deriveSessionTitle(firstMessage),
      agentKey: activeAgent.agentId,
    });
    if (!created.ok) {
      setError(created.error);
      return null;
    }
    setSessionId(created.sessionId);
    router.replace(`/${companySlug}/intelligence/chat/${created.sessionId}`, { scroll: false });
    return created.sessionId;
  }

  function submit() {
    const text = input.trim();
    if (!text) return;
    setError(null);
    setInput("");
    setPendingAttachments([]);
    addLocal("user", text);

    startTransition(async () => {
      const id = await ensureSession(text);
      if (!id) return;

      const result = await sendMessage({ sessionId: id, content: text });
      if (!result.ok) {
        setError(result.error);
        addLocal("system", result.error);
        return;
      }
      addLocal("assistant", summarize(result.assistant), { kind: result.assistant.kind });
      if (result.assistant.kind === "action_proposed") {
        setPendingAction({
          requestId: result.assistant.requestId,
          agentName: agentDisplayName,
          toolName: result.assistant.toolName,
          summary: result.assistant.summary,
          riskLabel: result.riskLabel,
        });
      }
    });
  }

  function decide(outcome: "approved" | "rejected") {
    if (!pendingAction) return;
    const { requestId } = pendingAction;
    startDecideTransition(async () => {
      const result = await decideAgentAction(requestId, outcome);
      setPendingAction(null);
      const text = result.ok ? (outcome === "approved" ? "Action confirmed." : "Action cancelled.") : result.error;
      addLocal("system", text);
      // Persisted (not just local state) so reopening the session never
      // shows an already-resolved proposal as pending again.
      if (sessionId) await recordSystemMessage({ sessionId, content: text });
    });
  }

  function applySuggestion(text: string) {
    setInput(text);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex flex-1 overflow-hidden">
      <ConversationHistoryDrawer
        companySlug={companySlug}
        sessions={historySessions}
        activeSessionId={sessionId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Hero -- same gradient/hero language as the Today dashboard, scaled down; chat stays the dominant element below it. */}
        <section className="relative overflow-hidden border-b border-[var(--border-subtle)] px-6 py-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 160% at 88% -20%, var(--accent-dim), transparent 55%), linear-gradient(180deg, var(--surface-2) 0%, var(--surface-1) 70%)",
            }}
          />
          <div className="relative flex items-center gap-2">
            <IconSparkle width={13} height={13} className="text-[var(--text-muted)]" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Orex Super Brain
            </span>
          </div>
          <h1 className="font-display relative mt-1.5 text-[24px] font-medium tracking-tight text-[var(--text-primary)]">
            Orex Intelligence
          </h1>
          <p className="relative mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
            Ask, analyze, plan and operate Orex OS from one intelligence layer.
          </p>
        </section>

        {/* Compact controls row */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="ox-focus-ring flex items-center gap-1.5 rounded-[var(--radius-s)] px-2 py-1 text-[11.5px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            >
              <IconHistory width={13} height={13} /> History
            </button>
            <span className="hidden truncate text-[12px] text-[var(--text-muted)] sm:inline">
              {sessionId ? historySessions.find((s) => s.id === sessionId)?.title ?? "Orex Intelligence" : "New conversation"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AgentSelector
              agents={agents}
              selectedAgentId={selectedAgentId}
              onSelect={setSelectedAgentId}
              manageHref={`/${companySlug}/intelligence/agents`}
            />
            <span className="ox-pill ox-pill-neutral hidden md:inline-flex">{companyName}</span>
            <Link
              href={`/${companySlug}/intelligence/control-room`}
              className="ox-focus-ring hidden items-center gap-1.5 rounded-[var(--radius-s)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] lg:flex"
              title="AI Management"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" /> AI Active · ${spendToday.toFixed(2)} today
            </Link>
            <button
              type="button"
              onClick={() => setContextOpen((v) => !v)}
              className="ox-focus-ring hidden h-7 w-7 place-items-center rounded-[var(--radius-s)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] lg:grid"
              title={contextOpen ? "Hide Context" : "Show Context"}
            >
              <IconSettings width={13} height={13} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
              <div className="max-w-lg text-center">
                <p className="font-display text-[22px] italic text-[var(--text-primary)]">Ayubowan.</p>
                <p className="mt-1 text-[15px] text-[var(--text-secondary)]">What do you want Orex to work on today?</p>
              </div>
              <div className="w-full max-w-2xl">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={submit}
                  disabled={isPending}
                  companyId={companyId}
                  organisationId={organisationId}
                  sessionId={sessionId}
                  onAttach={(a) => setPendingAttachments((prev) => [...prev, a])}
                />
                {error && <p className="ox-error mt-2">{error}</p>}
              </div>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {["What needs my attention?", "Review today's projects", "Show current risks", "What decisions need me?"].map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="ox-focus-ring rounded-[var(--radius-s)] border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)]"
                    >
                      {s}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-1 flex-col gap-6 px-6 py-6 md:px-10">
                {messages.map((m) => (
                  <div key={m.id} className="max-w-2xl">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {m.role === "user" ? "You" : m.role === "system" ? "System" : "Orex"}
                      </span>
                      <span className="text-[10.5px] text-[var(--text-muted)]">{timeLabel(m.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                      {m.content}
                    </p>
                  </div>
                ))}
                {pendingAction && (
                  <ActionProposalCard
                    agentName={pendingAction.agentName}
                    toolName={pendingAction.toolName}
                    summary={pendingAction.summary}
                    riskLabel={pendingAction.riskLabel}
                    disabled={isDeciding}
                    onApprove={() => decide("approved")}
                    onReject={() => decide("rejected")}
                  />
                )}
                {error && <p className="ox-error max-w-2xl">{error}</p>}
              </div>
              <div className="border-t border-[var(--border-subtle)] px-6 py-4 md:px-10">
                {pendingAttachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {pendingAttachments.map((a) => (
                      <AttachmentChip key={a.id} attachment={a} />
                    ))}
                  </div>
                )}
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={submit}
                  disabled={isPending || Boolean(pendingAction)}
                  companyId={companyId}
                  organisationId={organisationId}
                  sessionId={sessionId}
                  onAttach={(a) => setPendingAttachments((prev) => [...prev, a])}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:block">
        <ContextRail
          companyId={companyId}
          companyName={companyName}
          context={contextSummary}
          agents={agents}
          activeAgentId={selectedAgentId}
          isThinking={isPending}
          manageHref={`/${companySlug}/intelligence/agents`}
          canManageAgents={canManageAgents}
          recentActivity={recentActivity}
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          onSuggestion={applySuggestion}
        />
      </div>
    </div>
  );
}
