"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  renameSection,
  toggleSectionCollapsed,
  toggleSectionHidden,
  moveSection,
  deleteSection,
  duplicateSection,
} from "@/app/actions/project-sections";

export function WorkspaceSection({
  sectionId,
  projectId,
  title,
  sectionType,
  isCollapsed,
  isHidden,
  canEdit,
  children,
}: {
  sectionId: string;
  projectId: string;
  title: string;
  sectionType: "system" | "custom";
  isCollapsed: boolean;
  isHidden: boolean;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [collapsed, setCollapsed] = useState(isCollapsed);
  const [isPending, startTransition] = useTransition();

  function saveTitle() {
    setEditingTitle(false);
    if (titleValue === title) return;
    startTransition(async () => {
      await renameSection({ sectionId, projectId, title: titleValue });
      router.refresh();
    });
  }

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    startTransition(async () => {
      await toggleSectionCollapsed({ sectionId, projectId, isCollapsed: next });
    });
  }

  function toggleHide() {
    startTransition(async () => {
      await toggleSectionHidden({ sectionId, projectId, isHidden: !isHidden });
      router.refresh();
    });
  }

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveSection({ sectionId, projectId, direction });
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Delete section "${title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteSection({ sectionId, projectId });
      router.refresh();
    });
  }

  function duplicate() {
    startTransition(async () => {
      await duplicateSection({ sectionId, projectId });
      router.refresh();
    });
  }

  if (isHidden && !canEdit) return null;

  return (
    <section className={`rounded-md border border-[var(--border)] ${isHidden ? "opacity-50" : ""}`}>
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <button onClick={toggleCollapse} className="text-xs text-[var(--muted)]" title="Collapse/expand">
          {collapsed ? "▸" : "▾"}
        </button>
        {editingTitle && canEdit ? (
          <input
            autoFocus
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-sm font-medium"
          />
        ) : (
          <h3
            className={`flex-1 text-sm font-medium ${canEdit && sectionType === "custom" ? "cursor-text" : ""}`}
            onClick={() => canEdit && sectionType === "custom" && setEditingTitle(true)}
          >
            {title} {isHidden && <span className="text-xs text-[var(--muted)]">(hidden)</span>}
          </h3>
        )}
        {canEdit && (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <button disabled={isPending} onClick={() => move("up")} title="Move up">↑</button>
            <button disabled={isPending} onClick={() => move("down")} title="Move down">↓</button>
            <button disabled={isPending} onClick={toggleHide} title="Hide/show">
              {isHidden ? "Show" : "Hide"}
            </button>
            {sectionType === "custom" && (
              <>
                <button disabled={isPending} onClick={duplicate} title="Duplicate">Duplicate</button>
                <button disabled={isPending} onClick={remove} className="text-[var(--danger)]" title="Delete">
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </header>
      {!collapsed && <div className="space-y-2 p-3">{children}</div>}
    </section>
  );
}
