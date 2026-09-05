"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReadinessCheck, completeReadinessCheck } from "@/app/actions/project-readiness-checks";

export interface ReadinessCheckRow {
  id: string;
  title: string;
  is_required: boolean;
  status: string;
}

export function ReadinessChecklist({
  rows,
  projectId,
  canUpdate,
}: {
  rows: ReadinessCheckRow[];
  projectId: string;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [isPending, startTransition] = useTransition();

  function addCheck(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createReadinessCheck({ projectId, title, isRequired });
      setTitle("");
      router.refresh();
    });
  }

  function complete(checkId: string) {
    startTransition(async () => {
      await completeReadinessCheck({ checkId, projectId, decision: "complete" });
      router.refresh();
    });
  }

  return (
    <div>
      {canUpdate && (
        <form onSubmit={addCheck} className="flex flex-wrap items-end gap-2 p-4">
          <input
            required
            placeholder="e.g. QA complete, final files present"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
            Required
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
          >
            Add check
          </button>
        </form>
      )}
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--muted)]">No readiness checks yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                {row.title} {row.is_required && <span className="text-xs text-[var(--muted)]">(required)</span>}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`text-xs ${
                    row.status === "complete" ? "text-[var(--success)]" : "text-[var(--warning)]"
                  }`}
                >
                  {row.status}
                </span>
                {canUpdate && row.status === "pending" && (
                  <button
                    disabled={isPending}
                    onClick={() => complete(row.id)}
                    className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs disabled:opacity-50"
                  >
                    Mark complete
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
