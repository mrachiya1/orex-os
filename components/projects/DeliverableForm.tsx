"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDeliverable } from "@/app/actions/project-deliverables";

export function DeliverableForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [deliverableType, setDeliverableType] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createDeliverable({
          projectId,
          title,
          deliverableType,
          isRequired,
          referenceUrl: referenceUrl || undefined,
        });
        setTitle("");
        setDeliverableType("");
        setReferenceUrl("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add deliverable");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 p-4">
      <input
        required
        placeholder="Deliverable title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <input
        required
        placeholder="Type (final_render, design_file...)"
        value={deliverableType}
        onChange={(e) => setDeliverableType(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <input
        placeholder="Reference URL (Drive, Frame.io...)"
        value={referenceUrl}
        onChange={(e) => setReferenceUrl(e.target.value)}
        className="w-64 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      />
      <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
        <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
        Required for delivery
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add deliverable"}
      </button>
      {error && <p className="w-full text-sm text-[var(--danger)]">{error}</p>}
    </form>
  );
}
