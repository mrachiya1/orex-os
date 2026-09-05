"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Popover } from "@/components/ui/Popover";
import { deletePropertyDefinition } from "@/app/actions/project-properties";
import { IconCheck } from "@/components/ui/icons";
import type { SystemPropertyDef } from "@/lib/projects/system-properties";

export interface PropertyColumn {
  key: string;
  label: string;
  isCustom: boolean;
}

export function PropertiesPanel({
  systemProperties,
  customProperties,
  order,
  visibleColumns,
  onToggle,
  onMove,
  companyId,
}: {
  systemProperties: SystemPropertyDef[];
  customProperties: { id: string; name: string }[];
  order: string[];
  visibleColumns: string[];
  onToggle: (key: string) => void;
  onMove: (key: string, direction: "up" | "down") => void;
  companyId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const visible = new Set(visibleColumns);

  const columns: PropertyColumn[] = order
    .map((key) => {
      const sys = systemProperties.find((s) => s.key === key);
      if (sys) return { key, label: sys.label, isCustom: false };
      const custom = customProperties.find((c) => c.id === key);
      if (custom) return { key, label: custom.name, isCustom: true };
      return null;
    })
    .filter((c): c is PropertyColumn => c !== null);

  function remove(id: string) {
    startTransition(async () => {
      await deletePropertyDefinition({ propertyDefinitionId: id, companyId });
      router.refresh();
    });
  }

  return (
    <Popover
      align="right"
      trigger={<span className="ox-btn ox-btn-secondary ox-btn-sm">Properties</span>}
    >
      {() => (
        <div className="w-72 px-1 py-1.5">
          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Columns</div>
          <div className="flex max-h-80 flex-col overflow-y-auto">
            {columns.map((col, idx) => (
              <div key={col.key} className="group flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--surface-3)]">
                <button
                  type="button"
                  onClick={() => onToggle(col.key)}
                  className={`ox-focus-ring grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border ${
                    visible.has(col.key) ? "border-[var(--accent)] bg-[var(--accent)] text-[#101212]" : "border-[var(--border-strong)]"
                  }`}
                >
                  {visible.has(col.key) && <IconCheck width={10} height={10} />}
                </button>
                <span className="flex-1 truncate text-[12px] text-[var(--text-secondary)]">
                  {col.label}
                  {col.isCustom && <span className="ml-1.5 text-[9.5px] uppercase text-[var(--text-muted)]">custom</span>}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button type="button" disabled={idx === 0} onClick={() => onMove(col.key, "up")} className="ox-focus-ring px-1 text-[11px] text-[var(--text-muted)] disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" disabled={idx === columns.length - 1} onClick={() => onMove(col.key, "down")} className="ox-focus-ring px-1 text-[11px] text-[var(--text-muted)] disabled:opacity-30">
                    ↓
                  </button>
                  {col.isCustom && (
                    <button type="button" onClick={() => remove(col.key)} className="ox-focus-ring px-1 text-[11px] text-[var(--danger)]">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
