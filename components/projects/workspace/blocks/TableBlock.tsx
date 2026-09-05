"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBlock } from "@/app/actions/project-blocks";

type ColumnType = "text" | "number" | "select" | "checkbox" | "date" | "url";
interface Column {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[];
}
type CellValue = string | number | boolean | null;
type Row = Record<string, CellValue>;

export function TableBlock({
  blockId,
  projectId,
  content,
  canEdit,
}: {
  blockId: string;
  projectId: string;
  content: { columns: Column[]; rows: Row[] };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function persist(next: { columns: Column[]; rows: Row[] }) {
    setError(null);
    startTransition(async () => {
      try {
        await updateBlock({ blockId, projectId, content: next });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update table");
      }
    });
  }

  function addColumn() {
    const id = crypto.randomUUID();
    persist({ ...content, columns: [...content.columns, { id, name: "New column", type: "text" }] });
  }

  function renameColumn(id: string, name: string) {
    persist({ ...content, columns: content.columns.map((c) => (c.id === id ? { ...c, name } : c)) });
  }

  function deleteColumn(id: string) {
    persist({
      columns: content.columns.filter((c) => c.id !== id),
      rows: content.rows.map((r) => {
        const rest = { ...r };
        delete rest[id];
        return rest;
      }),
    });
  }

  function addRow() {
    persist({ ...content, rows: [...content.rows, {}] });
  }

  function updateCell(rowIndex: number, colId: string, value: CellValue) {
    const rows = content.rows.map((r, i) => (i === rowIndex ? { ...r, [colId]: value } : r));
    persist({ ...content, rows });
  }

  function deleteRow(rowIndex: number) {
    persist({ ...content, rows: content.rows.filter((_, i) => i !== rowIndex) });
  }

  return (
    <div className="overflow-x-auto">
      {error && <p className="mb-1 text-xs text-[var(--danger)]">{error}</p>}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {content.columns.map((col) => (
              <th key={col.id} className="px-2 py-1 text-left font-medium">
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={col.name}
                      onChange={(e) => renameColumn(col.id, e.target.value)}
                      className="w-full rounded border border-transparent bg-transparent px-1 hover:border-[var(--border)] focus:border-[var(--border)] focus:outline-none"
                    />
                    <button onClick={() => deleteColumn(col.id)} className="text-[var(--muted)]">
                      ×
                    </button>
                  </div>
                ) : (
                  col.name
                )}
              </th>
            ))}
            {canEdit && (
              <th className="px-2 py-1">
                <button onClick={addColumn} disabled={isPending} className="text-[var(--accent)]">
                  + Column
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[var(--border)]">
              {content.columns.map((col) => (
                <td key={col.id} className="px-2 py-1">
                  <Cell
                    column={col}
                    value={row[col.id] ?? null}
                    canEdit={canEdit}
                    onChange={(v) => updateCell(rowIndex, col.id, v)}
                  />
                </td>
              ))}
              {canEdit && (
                <td className="px-2 py-1">
                  <button onClick={() => deleteRow(rowIndex)} className="text-[var(--muted)]">
                    delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <button onClick={addRow} disabled={isPending} className="mt-1 text-xs text-[var(--accent)]">
          + Row
        </button>
      )}
    </div>
  );
}

function Cell({
  column,
  value,
  canEdit,
  onChange,
}: {
  column: Column;
  value: CellValue;
  canEdit: boolean;
  onChange: (v: CellValue) => void;
}) {
  if (!canEdit) return <span>{String(value ?? "")}</span>;

  if (column.type === "checkbox") {
    return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (column.type === "select") {
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5"
      >
        <option value="" />
        {(column.options ?? []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={column.type === "number" ? "number" : column.type === "date" ? "date" : column.type === "url" ? "url" : "text"}
      value={value == null ? "" : String(value)}
      onChange={(e) =>
        onChange(column.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
      }
      className="w-full rounded border border-transparent bg-transparent px-1 hover:border-[var(--border)] focus:border-[var(--border)] focus:outline-none"
    />
  );
}
