"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFolder } from "@/app/actions/project-folders";
import { IconPlus, IconChevronDown } from "@/components/ui/icons";

export interface FolderRow {
  id: string;
  name: string;
  parent_folder_id: string | null;
  position: number;
}

interface FolderNode extends FolderRow {
  children: FolderNode[];
}

function buildFolderTree(folders: FolderRow[]): FolderNode[] {
  const byId = new Map<string, FolderNode>(folders.map((f) => [f.id, { ...f, children: [] }]));
  const roots: FolderNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_folder_id && byId.has(node.parent_folder_id)) {
      byId.get(node.parent_folder_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export function FolderTree({
  folders,
  counts,
  totalCount,
  unfiledCount,
  selected,
  onSelect,
  organisationId,
  companyId,
  canUpdate,
}: {
  folders: FolderRow[];
  counts: Record<string, number>;
  totalCount: number;
  unfiledCount: number;
  selected: string | "unfiled" | "all";
  onSelect: (value: string | "unfiled" | "all") => void;
  organisationId: string;
  companyId: string;
  canUpdate: boolean;
}) {
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const [addingRoot, setAddingRoot] = useState(false);

  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--border-subtle)] px-3 py-2.5">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Folders</span>
        {canUpdate && (
          <button
            type="button"
            onClick={() => setAddingRoot(true)}
            className="ox-focus-ring text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="New folder"
          >
            <IconPlus width={12} height={12} />
          </button>
        )}
      </div>

      <FolderRowItem label="All Projects" count={totalCount} isSelected={selected === "all"} onClick={() => onSelect("all")} depth={0} />

      {tree.map((node) => (
        <FolderNodeItem
          key={node.id}
          node={node}
          counts={counts}
          selected={selected}
          onSelect={onSelect}
          organisationId={organisationId}
          companyId={companyId}
          canUpdate={canUpdate}
          depth={0}
        />
      ))}

      {addingRoot && (
        <InlineFolderForm
          organisationId={organisationId}
          companyId={companyId}
          parentFolderId={null}
          onDone={() => setAddingRoot(false)}
        />
      )}

      <FolderRowItem label="Unfiled Projects" count={unfiledCount} isSelected={selected === "unfiled"} onClick={() => onSelect("unfiled")} depth={0} muted />
    </div>
  );
}

function FolderNodeItem({
  node,
  counts,
  selected,
  onSelect,
  organisationId,
  companyId,
  canUpdate,
  depth,
}: {
  node: FolderNode;
  counts: Record<string, number>;
  selected: string | "unfiled" | "all";
  onSelect: (value: string | "unfiled" | "all") => void;
  organisationId: string;
  companyId: string;
  canUpdate: boolean;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="group flex items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ox-focus-ring grid h-4 w-4 shrink-0 place-items-center text-[var(--text-muted)]"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {node.children.length > 0 ? (
            <IconChevronDown width={10} height={10} style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
          ) : (
            <span className="h-1 w-1 rounded-full bg-[var(--border-strong)]" />
          )}
        </button>
        <div className="flex-1" style={{ paddingLeft: depth * 12 }}>
          <FolderRowItem label={node.name} count={counts[node.id] ?? 0} isSelected={selected === node.id} onClick={() => onSelect(node.id)} depth={0} inline />
        </div>
        {canUpdate && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ox-focus-ring text-[var(--text-muted)] opacity-0 hover:text-[var(--text-primary)] group-hover:opacity-100"
            aria-label="Add to folder"
          >
            <IconPlus width={11} height={11} />
          </button>
        )}
      </div>
      {adding && (
        <div style={{ paddingLeft: 16 + depth * 12 }}>
          <InlineFolderForm organisationId={organisationId} companyId={companyId} parentFolderId={node.id} onDone={() => setAdding(false)} />
        </div>
      )}
      {expanded &&
        node.children.map((child) => (
          <FolderNodeItem
            key={child.id}
            node={child}
            counts={counts}
            selected={selected}
            onSelect={onSelect}
            organisationId={organisationId}
            companyId={companyId}
            canUpdate={canUpdate}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function FolderRowItem({
  label,
  count,
  isSelected,
  onClick,
  depth,
  muted,
  inline,
}: {
  label: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
  depth: number;
  muted?: boolean;
  inline?: boolean;
}) {
  const content = (
    <button
      type="button"
      onClick={onClick}
      className={`ox-focus-ring flex w-full items-center gap-2 rounded-[var(--radius-s)] px-2 py-1 text-[12px] ${
        isSelected ? "bg-[var(--surface-raised)] text-[var(--text-primary)]" : muted ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
      } hover:bg-[var(--surface-2)]`}
      style={{ marginLeft: depth * 12 }}
    >
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="num text-[10.5px] text-[var(--text-muted)]">{count}</span>
    </button>
  );
  return inline ? content : <div>{content}</div>;
}

function InlineFolderForm({
  organisationId,
  companyId,
  parentFolderId,
  onDone,
}: {
  organisationId: string;
  companyId: string;
  parentFolderId: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await createFolder({ organisationId, companyId, name: name.trim(), parentFolderId: parentFolderId ?? undefined });
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 px-1 py-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name"
        className="ox-input h-7 flex-1 text-[11.5px]"
        onKeyDown={(e) => e.key === "Escape" && onDone()}
      />
      <button type="submit" disabled={isPending} className="ox-btn ox-btn-secondary ox-btn-sm">
        Add
      </button>
    </form>
  );
}
