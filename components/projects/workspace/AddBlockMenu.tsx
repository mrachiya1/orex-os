"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBlock } from "@/app/actions/project-blocks";

const SIMPLE_TYPES: Array<{ type: string; label: string; content: unknown }> = [
  { type: "text", label: "Text", content: { text: "" } },
  { type: "heading", label: "Heading", content: { text: "", level: 2 } },
  { type: "callout", label: "Callout", content: { text: "", tone: "info" } },
  { type: "checklist", label: "Checklist", content: { items: [] } },
  { type: "divider", label: "Divider", content: {} },
  {
    type: "table",
    label: "Table",
    content: { columns: [{ id: crypto.randomUUID?.() ?? "col-1", name: "Column 1", type: "text" }], rows: [] },
  },
];

const VIEW_SOURCES = ["tasks", "milestones", "deliverables", "scope_changes", "readiness_checks"] as const;

export function AddBlockMenu({ projectId, sectionId }: { projectId: string; sectionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "link" | "view">("menu");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [viewSource, setViewSource] = useState<(typeof VIEW_SOURCES)[number]>("tasks");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setOpen(false);
    setMode("menu");
    setError(null);
    setLinkUrl("");
    setLinkLabel("");
  }

  function addSimple(blockType: string, content: unknown) {
    setError(null);
    startTransition(async () => {
      try {
        await createBlock({ projectId, sectionId, blockType, content });
        router.refresh();
        reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add block");
      }
    });
  }

  function addLink(e: React.FormEvent) {
    e.preventDefault();
    addSimple("link", { url: linkUrl, label: linkLabel });
  }

  function addView(e: React.FormEvent) {
    e.preventDefault();
    addSimple("project_view", { sourceType: viewSource, displayMode: "list" });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-[var(--accent)]">
        + Add Block
      </button>
    );
  }

  if (mode === "link") {
    return (
      <form onSubmit={addLink} className="flex flex-wrap items-center gap-2">
        <input
          required
          placeholder="Label"
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
        />
        <input
          required
          placeholder="https://..."
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className="w-56 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
        />
        <button type="submit" disabled={isPending} className="text-xs text-[var(--accent)]">Add</button>
        <button type="button" onClick={reset} className="text-xs text-[var(--muted)]">Cancel</button>
        {error && <span className="w-full text-xs text-[var(--danger)]">{error}</span>}
      </form>
    );
  }

  if (mode === "view") {
    return (
      <form onSubmit={addView} className="flex flex-wrap items-center gap-2">
        <select
          value={viewSource}
          onChange={(e) => setViewSource(e.target.value as typeof viewSource)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
        >
          {VIEW_SOURCES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <button type="submit" disabled={isPending} className="text-xs text-[var(--accent)]">Add</button>
        <button type="button" onClick={reset} className="text-xs text-[var(--muted)]">Cancel</button>
        {error && <span className="w-full text-xs text-[var(--danger)]">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {SIMPLE_TYPES.map((t) => (
        <button
          key={t.type}
          disabled={isPending}
          onClick={() => addSimple(t.type, t.content)}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
        >
          {t.label}
        </button>
      ))}
      <button onClick={() => setMode("link")} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs">
        Link
      </button>
      <button onClick={() => setMode("view")} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs">
        Project View
      </button>
      <button onClick={reset} className="text-xs text-[var(--muted)]">Cancel</button>
      {error && <span className="w-full text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}
