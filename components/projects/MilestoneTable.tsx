"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMilestone } from "@/app/actions/project-milestones";

export interface MilestoneRow {
  id: string;
  title: string;
  status: string;
  is_blocking: boolean;
  due_date: string | null;
  sequence: number;
}

export function MilestoneTable({
  rows,
  projectId,
  canUpdate,
}: {
  rows: MilestoneRow[];
  projectId: string;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function complete(milestoneId: string) {
    startTransition(async () => {
      await updateMilestone({ milestoneId, projectId, status: "completed" });
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">No milestones yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <th className="px-4 py-2 font-medium">Title</th>
          <th className="px-4 py-2 font-medium">Status</th>
          <th className="px-4 py-2 font-medium">Blocking</th>
          <th className="px-4 py-2 font-medium">Due</th>
          <th className="px-4 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {[...rows].sort((a, b) => a.sequence - b.sequence).map((row) => (
          <tr key={row.id} className="border-b border-[var(--border)]">
            <td className="px-4 py-2">{row.title}</td>
            <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">{row.status}</td>
            <td className="px-4 py-2 text-xs">{row.is_blocking ? "Yes" : ""}</td>
            <td className="px-4 py-2 text-xs text-[var(--muted)]">{row.due_date ?? "—"}</td>
            <td className="px-4 py-2">
              {canUpdate && row.status !== "completed" && (
                <button
                  disabled={isPending}
                  onClick={() => complete(row.id)}
                  className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs disabled:opacity-50"
                >
                  Complete
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
