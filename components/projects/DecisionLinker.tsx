"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkDecisionToProject, unlinkDecisionFromProject } from "@/app/actions/project-decisions";

export interface LinkedDecisionRow {
  id: string;
  title: string;
  status: string;
}

export function DecisionLinker({
  rows,
  projectId,
  canLink,
}: {
  rows: LinkedDecisionRow[];
  projectId: string;
  canLink: boolean;
}) {
  const router = useRouter();
  const [decisionId, setDecisionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function link(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await linkDecisionToProject({ projectId, decisionId });
        setDecisionId("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to link decision");
      }
    });
  }

  function unlink(id: string) {
    startTransition(async () => {
      await unlinkDecisionFromProject({ projectId, decisionId: id });
      router.refresh();
    });
  }

  return (
    <div>
      {canLink && (
        <form onSubmit={link} className="flex items-end gap-2 p-4">
          <input
            required
            placeholder="Decision ID (from Company Brain)"
            value={decisionId}
            onChange={(e) => setDecisionId(e.target.value)}
            className="w-80 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
          >
            Link decision
          </button>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        </form>
      )}
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--muted)]">No decisions linked to this project.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                {row.title} <span className="text-xs text-[var(--muted)]">({row.status})</span>
              </span>
              {canLink && (
                <button
                  disabled={isPending}
                  onClick={() => unlink(row.id)}
                  className="text-xs text-[var(--muted)]"
                >
                  Unlink
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
