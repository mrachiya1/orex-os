"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveScopeChange } from "@/app/actions/project-scope-changes";

export interface ScopeChangeRow {
  id: string;
  summary: string;
  approval_state: string;
  is_blocking: boolean;
  created_at: string;
}

export function ScopeChangeTable({
  rows,
  projectId,
  canApprove,
}: {
  rows: ScopeChangeRow[];
  projectId: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function decide(scopeChangeId: string, decision: "approved" | "rejected") {
    startTransition(async () => {
      await approveScopeChange({ scopeChangeId, projectId, decision });
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">No scope changes recorded.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <th className="px-4 py-2 font-medium">Summary</th>
          <th className="px-4 py-2 font-medium">Blocking</th>
          <th className="px-4 py-2 font-medium">Approval</th>
          <th className="px-4 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-[var(--border)]">
            <td className="px-4 py-2">{row.summary}</td>
            <td className="px-4 py-2 text-xs">{row.is_blocking ? "Yes" : ""}</td>
            <td className="px-4 py-2">
              <span
                className={`text-xs ${
                  row.approval_state === "approved"
                    ? "text-[var(--success)]"
                    : row.approval_state === "rejected"
                      ? "text-[var(--danger)]"
                      : "text-[var(--warning)]"
                }`}
              >
                {row.approval_state}
              </span>
            </td>
            <td className="px-4 py-2 flex gap-2">
              {canApprove && row.approval_state === "pending" && (
                <>
                  <button
                    disabled={isPending}
                    onClick={() => decide(row.id, "approved")}
                    className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => decide(row.id, "rejected")}
                    className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
