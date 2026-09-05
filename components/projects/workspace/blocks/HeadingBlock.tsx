"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBlock } from "@/app/actions/project-blocks";

const SIZE: Record<1 | 2 | 3, string> = {
  1: "text-lg font-semibold",
  2: "text-base font-semibold",
  3: "text-sm font-semibold",
};

export function HeadingBlock({
  blockId,
  projectId,
  content,
  canEdit,
}: {
  blockId: string;
  projectId: string;
  content: { text: string; level: 1 | 2 | 3 };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(content.text);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (text === content.text) return;
    startTransition(async () => {
      await updateBlock({ blockId, projectId, content: { text, level: content.level } });
      router.refresh();
    });
  }

  if (!canEdit) {
    return <h3 className={SIZE[content.level]}>{content.text || "—"}</h3>;
  }

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      disabled={isPending}
      placeholder="Heading"
      className={`w-full rounded-md border border-transparent bg-transparent p-1 hover:border-[var(--border)] focus:border-[var(--border)] focus:bg-[var(--surface)] focus:outline-none ${SIZE[content.level]}`}
    />
  );
}
