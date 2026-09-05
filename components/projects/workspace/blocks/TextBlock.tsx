"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBlock } from "@/app/actions/project-blocks";

export function TextBlock({
  blockId,
  projectId,
  content,
  canEdit,
}: {
  blockId: string;
  projectId: string;
  content: { text: string };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(content.text);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (text === content.text) return;
    startTransition(async () => {
      await updateBlock({ blockId, projectId, content: { text } });
      router.refresh();
    });
  }

  if (!canEdit) {
    return <p className="whitespace-pre-wrap text-sm">{content.text || "—"}</p>;
  }

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      disabled={isPending}
      rows={3}
      placeholder="Type notes..."
      className="w-full resize-y rounded-md border border-transparent bg-transparent p-1 text-sm hover:border-[var(--border)] focus:border-[var(--border)] focus:bg-[var(--surface)] focus:outline-none"
    />
  );
}
