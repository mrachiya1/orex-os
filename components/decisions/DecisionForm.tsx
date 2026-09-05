"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDecision } from "@/app/actions/decisions";

export function DecisionForm({
  organisationId,
  companyId,
}: {
  organisationId: string;
  companyId: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [situation, setSituation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createDecision({ organisationId, companyId, title, situation, evidence: [], options: [] });
        setTitle("");
        setSituation("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create decision");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4">
      <input
        required
        placeholder="Decision title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <textarea
        required
        placeholder="Situation"
        value={situation}
        onChange={(e) => setSituation(e.target.value)}
        rows={2}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Record decision"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </form>
  );
}
