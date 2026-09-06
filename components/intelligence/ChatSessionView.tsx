"use client";

import { useState, useTransition } from "react";
import { sendMessage } from "@/app/actions/messages";
import { decideAgentAction, type CompanyBrainCommandResult } from "@/app/actions/agent-actions";
import { Button } from "@/components/ui/Button";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function summarize(result: CompanyBrainCommandResult): string {
  if (result.kind === "answer") return result.answer;
  if (result.kind === "needs_clarification") return result.question;
  if (result.kind === "action_proposed") return result.summary;
  return `Done — ${result.summary}`;
}

/** Session-persisted extension of AskCompanyBrainBox's question/command/confirm pattern. */
export function ChatSessionView({ sessionId, initialMessages }: { sessionId: string; initialMessages: StoredMessage[] }) {
  const [messages, setMessages] = useState<StoredMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pendingAction, setPendingAction] = useState<{ requestId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeciding, startDecideTransition] = useTransition();

  function addLocal(role: StoredMessage["role"], content: string, metadata: Record<string, unknown> = {}) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content, metadata, created_at: new Date().toISOString() }]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setError(null);
    setInput("");
    addLocal("user", text);

    startTransition(async () => {
      const result = await sendMessage({ sessionId, content: text });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      addLocal("assistant", summarize(result.assistant), { kind: result.assistant.kind });
      if (result.assistant.kind === "action_proposed") {
        setPendingAction({ requestId: result.assistant.requestId });
      }
    });
  }

  function decide(outcome: "approved" | "rejected") {
    if (!pendingAction) return;
    const { requestId } = pendingAction;
    startDecideTransition(async () => {
      const result = await decideAgentAction(requestId, outcome);
      setPendingAction(null);
      addLocal("system", result.ok ? (outcome === "approved" ? "Action confirmed." : "Action cancelled.") : result.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-8">
        {messages.length === 0 && (
          <p className="text-[12.5px] text-[var(--text-muted)]">
            Ask, analyze, plan or command Orex OS…
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-2xl rounded-[var(--radius-m)] border px-3.5 py-2.5 text-[12.5px] ${
              m.role === "user"
                ? "self-end border-[var(--border-medium)] bg-[var(--surface-raised)] text-[var(--text-primary)]"
                : m.role === "system"
                  ? "self-start border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-muted)]"
                  : "self-start border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-primary)]"
            }`}
          >
            {m.content}
          </div>
        ))}
        {pendingAction && (
          <div className="flex max-w-2xl gap-2 self-start">
            <Button type="button" variant="primary" size="sm" disabled={isDeciding} onClick={() => decide("approved")}>
              Confirm
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={isDeciding} onClick={() => decide("rejected")}>
              Cancel
            </Button>
          </div>
        )}
        {error && <p className="ox-error">{error}</p>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-[var(--border-subtle)] p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask, analyze, plan or command Orex OS…"
          className="ox-input flex-1"
          disabled={isPending}
        />
        <Button type="submit" variant="primary" disabled={isPending || Boolean(pendingAction)}>
          {isPending ? "Thinking…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
