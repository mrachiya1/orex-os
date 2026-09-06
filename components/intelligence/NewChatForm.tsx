"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/app/actions/sessions";
import { Button } from "@/components/ui/Button";

export function NewChatForm({
  organisationId,
  companyId,
  companySlug,
}: {
  organisationId: string;
  companyId: string;
  companySlug: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSession({
        organisationId,
        companyId,
        title: title.trim() || "New session",
        agentKey: "advisor",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/${companySlug}/intelligence/chat/${result.sessionId}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="ox-field">
        <span className="ox-label">Title (optional)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. IRWAY Delivery Planning"
          className="ox-input"
        />
      </label>
      {error && <p className="ox-error">{error}</p>}
      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Starting…" : "Start session"}
      </Button>
      <p className="text-[11px] text-[var(--text-muted)]">
        Ask, analyze, plan or command Orex OS — the Company Brain Advisor agent handles both questions and
        confirmed actions in the same conversation.
      </p>
    </form>
  );
}
