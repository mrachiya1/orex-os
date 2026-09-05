"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMilestone } from "@/app/actions/project-milestones";

export function MilestoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createMilestone({ projectId, title, dueDate: dueDate || undefined, isBlocking });
        setTitle("");
        setDueDate("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add milestone");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 p-4">
      <input
        required
        placeholder="Milestone title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
        <input type="checkbox" checked={isBlocking} onChange={(e) => setIsBlocking(e.target.checked)} />
        Blocking (required for delivery)
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add milestone"}
      </button>
      {error && <p className="w-full text-sm text-[var(--danger)]">{error}</p>}
    </form>
  );
}
