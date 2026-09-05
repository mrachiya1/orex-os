"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveDeliverable } from "@/app/actions/project-deliverables";
import { DeliveryForm } from "./DeliveryForm";

export interface DeliverableRow {
  id: string;
  title: string;
  deliverable_type: string;
  status: string;
  approval_state: string;
  is_required: boolean;
  reference_url: string | null;
}

export function DeliverableTable({
  rows,
  projectId,
  canApprove,
  canDeliver,
}: {
  rows: DeliverableRow[];
  projectId: string;
  canApprove: boolean;
  canDeliver: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  function decide(deliverableId: string, decision: "approved" | "rejected") {
    startTransition(async () => {
      await approveDeliverable({ deliverableId, projectId, decision });
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">No deliverables yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <th className="px-4 py-2 font-medium">Title</th>
          <th className="px-4 py-2 font-medium">Type</th>
          <th className="px-4 py-2 font-medium">Required</th>
          <th className="px-4 py-2 font-medium">Approval</th>
          <th className="px-4 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Fragment key={row.id}>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-2">
                {row.title}
                {row.reference_url && (
                  <a
                    href={row.reference_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs text-[var(--muted)] underline"
                  >
                    reference
                  </a>
                )}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">{row.deliverable_type}</td>
              <td className="px-4 py-2 text-xs">{row.is_required ? "Yes" : "Optional"}</td>
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
                {canDeliver && row.approval_state === "approved" && (
                  <button
                    onClick={() => setDeliveringId(deliveringId === row.id ? null : row.id)}
                    className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-black"
                  >
                    Deliver
                  </button>
                )}
              </td>
            </tr>
            {deliveringId === row.id && (
              <tr>
                <td colSpan={5}>
                  <DeliveryForm
                    projectId={projectId}
                    deliverableId={row.id}
                    onDone={() => setDeliveringId(null)}
                  />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
