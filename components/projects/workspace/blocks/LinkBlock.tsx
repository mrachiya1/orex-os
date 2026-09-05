"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBlock } from "@/app/actions/project-blocks";

export function LinkBlock({
  blockId,
  projectId,
  content,
  canEdit,
}: {
  blockId: string;
  projectId: string;
  content: { url: string; label: string };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(content.label);
  const [url, setUrl] = useState(content.url);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (label === content.label && url === content.url) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateBlock({ blockId, projectId, content: { label, url } });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid link");
      }
    });
  }

  if (!canEdit) {
    return (
      <a href={content.url} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent)] underline">
        {content.label || content.url}
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={save}
        placeholder="Label"
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={save}
        placeholder="https://..."
        disabled={isPending}
        className="w-64 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
      />
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}
