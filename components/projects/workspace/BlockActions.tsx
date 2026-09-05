"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBlock, moveBlock } from "@/app/actions/project-blocks";

export function BlockActions({ blockId, projectId }: { blockId: string; projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveBlock({ blockId, projectId, direction });
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete this block?")) return;
    startTransition(async () => {
      await deleteBlock({ blockId, projectId });
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
      <button disabled={isPending} onClick={() => move("up")} className="text-xs text-[var(--muted)]" title="Move up">
        ↑
      </button>
      <button disabled={isPending} onClick={() => move("down")} className="text-xs text-[var(--muted)]" title="Move down">
        ↓
      </button>
      <button disabled={isPending} onClick={remove} className="text-xs text-[var(--danger)]" title="Delete">
        ×
      </button>
    </div>
  );
}
