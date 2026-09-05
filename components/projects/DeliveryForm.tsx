"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordDelivery } from "@/app/actions/project-deliveries";

export function DeliveryForm({
  projectId,
  deliverableId,
  onDone,
}: {
  projectId: string;
  deliverableId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await recordDelivery({
          deliverableId,
          projectId,
          destination: destination || undefined,
          referenceUrl: referenceUrl || undefined,
          notes: notes || undefined,
        });
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record delivery");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] p-3">
      <input
        placeholder="Destination (client email, Drive folder...)"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--overlay)] px-3 py-1.5 text-sm"
      />
      <input
        placeholder="Reference URL"
        value={referenceUrl}
        onChange={(e) => setReferenceUrl(e.target.value)}
        className="w-64 rounded-md border border-[var(--border)] bg-[var(--overlay)] px-3 py-1.5 text-sm"
      />
      <input
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--overlay)] px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
      >
        {isPending ? "Recording..." : "Confirm delivery"}
      </button>
      {error && <p className="w-full text-sm text-[var(--danger)]">{error}</p>}
    </form>
  );
}
