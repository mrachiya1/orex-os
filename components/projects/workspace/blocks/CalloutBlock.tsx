"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBlock } from "@/app/actions/project-blocks";

const TONE_STYLE: Record<string, string> = {
  info: "border-[var(--border)] bg-[var(--surface)]",
  warning: "border-[var(--warning)] bg-[var(--surface)]",
  success: "border-[var(--success)] bg-[var(--surface)]",
  danger: "border-[var(--danger)] bg-[var(--surface)]",
};

export function CalloutBlock({
  blockId,
  projectId,
  content,
  canEdit,
}: {
  blockId: string;
  projectId: string;
  content: { text: string; tone: "info" | "warning" | "success" | "danger" };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(content.text);
  const [isPending, startTransition] = useTransition();

  function save(next: Partial<typeof content>) {
    const updated = { ...content, text, ...next };
    startTransition(async () => {
      await updateBlock({ blockId, projectId, content: updated });
      router.refresh();
    });
  }

  return (
    <div className={`rounded-md border-l-4 p-3 text-sm ${TONE_STYLE[content.tone]}`}>
      {canEdit ? (
        <div className="flex items-start gap-2">
          <select
            value={content.tone}
            onChange={(e) => save({ tone: e.target.value as typeof content.tone })}
            disabled={isPending}
            className="rounded-md border border-[var(--border)] bg-[var(--overlay)] px-1 py-0.5 text-xs"
          >
            {["info", "warning", "success", "danger"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => save({})}
            disabled={isPending}
            rows={2}
            className="flex-1 resize-y rounded-md border border-transparent bg-transparent p-1 text-sm focus:border-[var(--border)] focus:bg-[var(--overlay)] focus:outline-none"
          />
        </div>
      ) : (
        <p className="whitespace-pre-wrap">{content.text}</p>
      )}
    </div>
  );
}
