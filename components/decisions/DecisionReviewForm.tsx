"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewDecision } from "@/app/actions/decisions";

export function DecisionReviewForm({ decisionId, companyId }: { decisionId: string; companyId: string | null }) {
  const router = useRouter();
  const [actualResult, setActualResult] = useState("");
  const [lesson, setLesson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await reviewDecision({ decisionId, companyId, actualResult, lesson: lesson || undefined });
        setActualResult("");
        setLesson("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record review");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-[var(--border)] p-4">
      <h3 className="text-sm font-medium">Add review</h3>
      <textarea
        required
        placeholder="What actually happened?"
        value={actualResult}
        onChange={(e) => setActualResult(e.target.value)}
        rows={2}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <textarea
        placeholder="Lesson (optional)"
        value={lesson}
        onChange={(e) => setLesson(e.target.value)}
        rows={2}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-[var(--border)] px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Add review"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </form>
  );
}
