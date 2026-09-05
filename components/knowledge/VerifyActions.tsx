"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyKnowledgeItem, archiveKnowledgeItem } from "@/app/actions/knowledge";

export function VerifyActions({
  knowledgeItemId,
  companyId,
  canVerify,
  canArchive,
}: {
  knowledgeItemId: string;
  companyId: string | null;
  canVerify: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function act(decision: "verified" | "rejected") {
    startTransition(async () => {
      await verifyKnowledgeItem({ knowledgeItemId, companyId, decision });
      router.refresh();
    });
  }

  function archive() {
    startTransition(async () => {
      await archiveKnowledgeItem({ knowledgeItemId, companyId });
      router.refresh();
    });
  }

  if (!canVerify && !canArchive) return null;

  return (
    <div className="flex gap-2 border-t border-[var(--border)] p-4">
      {canVerify && (
        <>
          <button
            disabled={isPending}
            onClick={() => act("verified")}
            className="rounded-md bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
          >
            Verify
          </button>
          <button
            disabled={isPending}
            onClick={() => act("rejected")}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Reject
          </button>
        </>
      )}
      {canArchive && (
        <button
          disabled={isPending}
          onClick={archive}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] disabled:opacity-50"
        >
          Archive
        </button>
      )}
    </div>
  );
}
