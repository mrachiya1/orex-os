"use client";

import { useState, useTransition } from "react";
import { runCompanyBrainCommand, decideAgentAction } from "@/app/actions/agent-actions";
import { Button } from "@/components/ui/Button";
import { IconSparkle } from "@/components/ui/icons";

type ViewState =
  | { kind: "answer"; answer: string; citedSources: Array<{ knowledgeItemId: string; title: string }> }
  | { kind: "needs_clarification"; question: string }
  | { kind: "action_proposed"; requestId: string; summary: string }
  | { kind: "action_executed"; summary: string }
  | { kind: "action_rejected" };

/**
 * Handles both questions and commands through one input (prompts/013-ai-
 * action-engine.md Tier 2, "One action engine. Multiple entry points.") --
 * a question renders as plain text exactly like before; a command that
 * resolves to a real, permission-checked action renders as a confirm/
 * cancel card and never executes until the user clicks Confirm.
 */
export function AskCompanyBrainBox({
  organisationId,
  companyId,
}: {
  organisationId: string;
  companyId: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeciding, startDecideTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setView(null);
    startTransition(async () => {
      const res = await runCompanyBrainCommand({ organisationId, companyId, question });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.kind === "action_proposed") {
        setView({ kind: "action_proposed", requestId: res.requestId, summary: res.summary });
      } else if (res.kind === "action_executed") {
        setView({ kind: "action_executed", summary: res.summary });
      } else if (res.kind === "needs_clarification") {
        setView({ kind: "needs_clarification", question: res.question });
      } else {
        setView({ kind: "answer", answer: res.answer, citedSources: res.citedSources });
      }
    });
  }

  function handleDecision(requestId: string, decision: "approved" | "rejected") {
    startDecideTransition(async () => {
      const res = await decideAgentAction(requestId, decision);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setView(decision === "rejected" ? { kind: "action_rejected" } : { kind: "action_executed", summary: "Done." });
    });
  }

  return (
    <div className="ox-card px-5 py-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
        <IconSparkle width={13} height={13} className="text-[var(--text-muted)]" />
        Ask or command Company Brain
      </h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          required
          placeholder='e.g. "What are our current priorities?" or "Add a task to IRWAY: send final renders tomorrow"'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="ox-input flex-1"
        />
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Thinking…" : "Ask"}
        </Button>
      </form>
      {error && <p className="ox-error mt-2">{error}</p>}

      {view?.kind === "answer" && (
        <div className="mt-3 rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5 text-[12.5px]">
          <p className="text-[var(--text-primary)]">{view.answer}</p>
          {view.citedSources.length > 0 && (
            <ul className="mt-2.5 space-y-0.5 text-[11px] text-[var(--text-muted)]">
              {view.citedSources.map((s) => (
                <li key={s.knowledgeItemId}>Source: {s.title}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view?.kind === "needs_clarification" && (
        <div className="mt-3 rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5 text-[12.5px]">
          <p className="text-[var(--text-secondary)]">{view.question}</p>
        </div>
      )}

      {view?.kind === "action_proposed" && (
        <div className="mt-3 rounded-[var(--radius-m)] border border-[var(--border-medium)] bg-[var(--surface-sunken)] p-3.5 text-[12.5px]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Confirm action
          </p>
          <p className="text-[var(--text-primary)]">{view.summary}</p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isDeciding}
              onClick={() => handleDecision(view.requestId, "approved")}
            >
              Confirm
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeciding}
              onClick={() => handleDecision(view.requestId, "rejected")}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {view?.kind === "action_executed" && (
        <div className="mt-3 rounded-[var(--radius-m)] border border-[var(--success)] bg-[var(--surface-sunken)] p-3.5 text-[12.5px]">
          <p className="text-[var(--success)]">Done — {view.summary}</p>
        </div>
      )}

      {view?.kind === "action_rejected" && (
        <div className="mt-3 rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5 text-[12.5px]">
          <p className="text-[var(--text-muted)]">Cancelled — nothing was changed.</p>
        </div>
      )}
    </div>
  );
}
