"use client";

import { useState, useTransition } from "react";
import { askCompanyBrain } from "@/app/actions/knowledge";
import { Button } from "@/components/ui/Button";
import { IconSparkle } from "@/components/ui/icons";

export function AskCompanyBrainBox({
  organisationId,
  companyId,
}: {
  organisationId: string;
  companyId: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<{
    answer: string;
    citedSources: Array<{ knowledgeItemId: string; title: string }>;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAnswer(null);
    startTransition(async () => {
      const res = await askCompanyBrain({ organisationId, companyId, question });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAnswer(res);
    });
  }

  return (
    <div className="ox-card px-5 py-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
        <IconSparkle width={13} height={13} className="text-[var(--text-muted)]" />
        Ask Company Brain
      </h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          required
          placeholder="e.g. What are our current priorities?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="ox-input flex-1"
        />
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Thinking…" : "Ask"}
        </Button>
      </form>
      {error && <p className="ox-error mt-2">{error}</p>}
      {answer && (
        <div className="mt-3 rounded-[var(--radius-m)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5 text-[12.5px]">
          <p className="text-[var(--text-primary)]">{answer.answer}</p>
          {answer.citedSources.length > 0 && (
            <ul className="mt-2.5 space-y-0.5 text-[11px] text-[var(--text-muted)]">
              {answer.citedSources.map((s) => (
                <li key={s.knowledgeItemId}>Source: {s.title}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
