"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBlock } from "@/app/actions/project-blocks";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export function ChecklistBlock({
  blockId,
  projectId,
  content,
  canEdit,
}: {
  blockId: string;
  projectId: string;
  content: { items: ChecklistItem[] };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [newItemText, setNewItemText] = useState("");
  const [isPending, startTransition] = useTransition();

  function persist(items: ChecklistItem[]) {
    startTransition(async () => {
      await updateBlock({ blockId, projectId, content: { items } });
      router.refresh();
    });
  }

  function toggle(id: string) {
    persist(content.items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemText.trim()) return;
    persist([...content.items, { id: crypto.randomUUID(), text: newItemText, checked: false }]);
    setNewItemText("");
  }

  function removeItem(id: string) {
    persist(content.items.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-1 text-sm">
      {content.items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.checked}
            disabled={!canEdit || isPending}
            onChange={() => toggle(item.id)}
          />
          <span className={item.checked ? "text-[var(--muted)] line-through" : ""}>{item.text}</span>
          {canEdit && (
            <button onClick={() => removeItem(item.id)} className="ml-auto text-xs text-[var(--muted)]">
              remove
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <form onSubmit={addItem} className="flex items-center gap-2 pt-1">
          <input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Add item..."
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
          />
          <button type="submit" className="text-xs text-[var(--accent)]">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
