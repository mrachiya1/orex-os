"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/app/actions/project-tasks";

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_user_id: string | null;
}

export function TaskTable({
  rows,
  projectId,
  currentUserId,
  canUpdate,
}: {
  rows: TaskRow[];
  projectId: string;
  currentUserId: string;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(taskId: string, status: string) {
    startTransition(async () => {
      await updateTaskStatus({ taskId, projectId, status });
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">No tasks yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <th className="px-4 py-2 font-medium">Title</th>
          <th className="px-4 py-2 font-medium">Status</th>
          <th className="px-4 py-2 font-medium">Priority</th>
          <th className="px-4 py-2 font-medium">Due</th>
          <th className="px-4 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const canAct = canUpdate || row.assignee_user_id === currentUserId;
          return (
            <tr key={row.id} className="border-b border-[var(--border)]">
              <td className="px-4 py-2">{row.title}</td>
              <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">{row.status}</td>
              <td className="px-4 py-2 text-xs">{row.priority}</td>
              <td className="px-4 py-2 text-xs text-[var(--muted)]">{row.due_date ?? "—"}</td>
              <td className="px-4 py-2">
                {canAct && row.status !== "done" && (
                  <button
                    disabled={isPending}
                    onClick={() => setStatus(row.id, "done")}
                    className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs disabled:opacity-50"
                  >
                    Mark done
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
