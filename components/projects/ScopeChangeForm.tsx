"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createScopeChange } from "@/app/actions/project-scope-changes";

export function ScopeChangeForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createScopeChange({ projectId, summary, reason: reason || undefined, isBlocking });
        setSummary("");
        setReason("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record scope change");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4">
      <input
        required
        placeholder="What changed?"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <input
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
          <input type="checkbox" checked={isBlocking} onChange={(e) => setIsBlocking(e.target.checked)} />
          Blocks delivery until approved
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {isPending ? "Recording..." : "Record scope change"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </form>
  );
}
