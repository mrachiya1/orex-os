"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverOption } from "@/components/ui/Popover";
import { changeProjectStatus, updateProject, updateProjectHealth } from "@/app/actions/projects";
import { setPropertyValue } from "@/app/actions/project-properties";
import { moveProjectToFolder } from "@/app/actions/project-folders";
import { TRANSITIONS } from "@/lib/projects/lifecycle-graph";
import { StatusBadge, HealthBadge } from "@/components/projects/ProjectStatusBadge";
import type { ProjectStatus, ProjectHealthState, ProjectPriority } from "@/lib/projects/types";
import type { PropertyType } from "@/lib/projects/property-types";

const PRIORITY_TONE: Record<ProjectPriority, string> = {
  low: "ox-pill-neutral",
  normal: "ox-pill-neutral",
  high: "ox-pill-warning",
  urgent: "ox-pill-danger",
};

const HEALTH_OPTIONS: ProjectHealthState[] = ["healthy", "attention", "at_risk", "blocked"];
const PRIORITY_OPTIONS: ProjectPriority[] = ["low", "normal", "high", "urgent"];

function useRowMutation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  }
  return { run, isPending };
}

export function StatusCell({ projectId, status, canUpdate }: { projectId: string; status: ProjectStatus; canUpdate: boolean }) {
  const { run } = useRowMutation();
  const options = (TRANSITIONS[status] ?? []).filter((s) => s !== "delivery_ready");

  if (!canUpdate || options.length === 0) return <StatusBadge status={status} />;

  return (
    <Popover trigger={<StatusBadge status={status} />}>
      {(close) => (
        <>
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Move to</div>
          {options.map((s) => (
            <PopoverOption
              key={s}
              onClick={() => {
                run(() => changeProjectStatus({ projectId, targetStatus: s }));
                close();
              }}
            >
              {s.replace(/_/g, " ")}
            </PopoverOption>
          ))}
        </>
      )}
    </Popover>
  );
}

export function PriorityCell({ projectId, priority, canUpdate }: { projectId: string; priority: ProjectPriority; canUpdate: boolean }) {
  const { run } = useRowMutation();
  const badge = <span className={`ox-pill ${PRIORITY_TONE[priority]}`}>{priority}</span>;
  if (!canUpdate) return badge;

  return (
    <Popover trigger={badge}>
      {(close) => (
        <>
          {PRIORITY_OPTIONS.map((p) => (
            <PopoverOption
              key={p}
              active={p === priority}
              onClick={() => {
                run(() => updateProject({ projectId, priority: p }));
                close();
              }}
            >
              {p}
            </PopoverOption>
          ))}
        </>
      )}
    </Popover>
  );
}

export function HealthCell({ projectId, health, canUpdate }: { projectId: string; health: ProjectHealthState; canUpdate: boolean }) {
  const { run } = useRowMutation();
  const badge = <HealthBadge health={health} />;
  if (!canUpdate) return badge;

  return (
    <Popover trigger={badge}>
      {(close) => (
        <>
          {HEALTH_OPTIONS.map((h) => (
            <PopoverOption
              key={h}
              active={h === health}
              onClick={() => {
                run(() => updateProjectHealth({ projectId, healthState: h }));
                close();
              }}
            >
              {h.replace(/_/g, " ")}
            </PopoverOption>
          ))}
        </>
      )}
    </Popover>
  );
}

export function AssignedCell({
  projectId,
  leadId,
  members,
  canUpdate,
}: {
  projectId: string;
  leadId: string | null;
  members: { id: string; name: string }[];
  canUpdate: boolean;
}) {
  const { run } = useRowMutation();
  const current = members.find((m) => m.id === leadId);
  const trigger = current ? (
    <span className="text-[12px] text-[var(--text-secondary)]">{current.name}</span>
  ) : (
    <span className="text-[12px] text-[var(--text-muted)]">—</span>
  );
  if (!canUpdate) return trigger;

  return (
    <Popover trigger={trigger}>
      {(close) => (
        <>
          <PopoverOption
            onClick={() => {
              run(() => updateProject({ projectId, leadId: null }));
              close();
            }}
          >
            Unassigned
          </PopoverOption>
          {members.map((m) => (
            <PopoverOption
              key={m.id}
              active={m.id === leadId}
              onClick={() => {
                run(() => updateProject({ projectId, leadId: m.id }));
                close();
              }}
            >
              {m.name}
            </PopoverOption>
          ))}
        </>
      )}
    </Popover>
  );
}

export function FolderCell({
  projectId,
  folderId,
  folders,
  canUpdate,
}: {
  projectId: string;
  folderId: string | null;
  folders: { id: string; name: string }[];
  canUpdate: boolean;
}) {
  const { run } = useRowMutation();
  const current = folders.find((f) => f.id === folderId);
  const trigger = <span className="text-[12px] text-[var(--text-secondary)]">{current?.name ?? "Unfiled"}</span>;
  if (!canUpdate) return trigger;

  return (
    <Popover trigger={trigger}>
      {(close) => (
        <>
          <PopoverOption
            active={!folderId}
            onClick={() => {
              run(() => moveProjectToFolder({ projectId, folderId: null }));
              close();
            }}
          >
            Unfiled
          </PopoverOption>
          {folders.map((f) => (
            <PopoverOption
              key={f.id}
              active={f.id === folderId}
              onClick={() => {
                run(() => moveProjectToFolder({ projectId, folderId: f.id }));
                close();
              }}
            >
              {f.name}
            </PopoverOption>
          ))}
        </>
      )}
    </Popover>
  );
}

function InlineTextCell({
  value,
  placeholder,
  canUpdate,
  onCommit,
  suggestions,
  isDate,
}: {
  value: string | null;
  placeholder?: string;
  canUpdate: boolean;
  onCommit: (next: string) => void;
  suggestions?: string[];
  isDate?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [editing, setEditing] = useState(false);

  if (!canUpdate) {
    return <span className={isDate ? "num text-[12px] text-[var(--text-secondary)]" : "text-[12px] text-[var(--text-secondary)]"}>{value || "—"}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        className={`ox-focus-ring block w-full text-left ${isDate ? "num text-[12px]" : "text-[12px]"} ${value ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}
      >
        {value || placeholder || "—"}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type={isDate ? "date" : "text"}
      value={draft}
      list={suggestions ? "project-category-suggestions" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== (value ?? "")) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="ox-input h-7 w-full text-[12px]"
    />
  );
}

export function CategoryCell({ projectId, projectType, canUpdate, suggestions }: { projectId: string; projectType: string; canUpdate: boolean; suggestions: string[] }) {
  const { run } = useRowMutation();
  return (
    <>
      <InlineTextCell
        value={projectType}
        canUpdate={canUpdate}
        suggestions={suggestions}
        onCommit={(next) => next.trim() && run(() => updateProject({ projectId, projectType: next.trim() }))}
      />
      <datalist id="project-category-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

export function ClientCell({ projectId, clientDisplayName, canUpdate }: { projectId: string; clientDisplayName: string | null; canUpdate: boolean }) {
  const { run } = useRowMutation();
  return (
    <InlineTextCell
      value={clientDisplayName}
      placeholder="Add client…"
      canUpdate={canUpdate}
      onCommit={(next) => run(() => updateProject({ projectId, clientDisplayName: next }))}
    />
  );
}

export function DateCell({
  projectId,
  field,
  value,
  canUpdate,
}: {
  projectId: string;
  field: "targetDate" | "startDate";
  value: string | null;
  canUpdate: boolean;
}) {
  const { run } = useRowMutation();
  return (
    <InlineTextCell
      value={value}
      isDate
      canUpdate={canUpdate}
      onCommit={(next) => run(() => updateProject({ projectId, [field]: next || undefined } as never))}
    />
  );
}

export function NextTaskCell({ task }: { task: { title: string; due_date: string | null } | null }) {
  if (!task) return <span className="text-[12px] text-[var(--text-muted)]">—</span>;
  return (
    <span className="text-[12px] text-[var(--text-secondary)]" title={task.title}>
      {task.title.length > 28 ? task.title.slice(0, 28) + "…" : task.title}
    </span>
  );
}

export function CustomPropertyCell({
  projectId,
  propertyDefinitionId,
  propertyType,
  configuration,
  value,
  members,
  canUpdate,
}: {
  projectId: string;
  propertyDefinitionId: string;
  propertyType: PropertyType;
  configuration: { options?: Array<{ id: string; label: string }> };
  value: unknown;
  members: { id: string; name: string }[];
  canUpdate: boolean;
}) {
  const { run } = useRowMutation();
  const commit = (v: unknown) => run(() => setPropertyValue({ projectId, propertyDefinitionId, value: v }));

  switch (propertyType) {
    case "checkbox":
      return (
        <button
          type="button"
          disabled={!canUpdate}
          onClick={() => commit(!value)}
          aria-label="Toggle"
          className={`ox-focus-ring grid h-4 w-4 place-items-center rounded-[4px] border ${
            value ? "border-[var(--success)] bg-[var(--success)] text-[#08090a]" : "border-[var(--border-strong)]"
          }`}
        >
          {value ? "✓" : ""}
        </button>
      );
    case "select":
    case "status": {
      const options = configuration.options ?? [];
      const current = options.find((o) => o.id === value);
      const badge = <span className="ox-pill ox-pill-neutral">{current?.label ?? "—"}</span>;
      if (!canUpdate) return badge;
      return (
        <Popover trigger={badge}>
          {(close) => (
            <>
              <PopoverOption onClick={() => { commit(null); close(); }}>—</PopoverOption>
              {options.map((o) => (
                <PopoverOption key={o.id} active={o.id === value} onClick={() => { commit(o.id); close(); }}>
                  {o.label}
                </PopoverOption>
              ))}
            </>
          )}
        </Popover>
      );
    }
    case "multi_select": {
      const options = configuration.options ?? [];
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      const labels = options.filter((o) => selected.has(o.id)).map((o) => o.label);
      const badge = (
        <div className="flex flex-wrap gap-1">
          {labels.length === 0 ? <span className="text-[12px] text-[var(--text-muted)]">—</span> : labels.map((l) => <span key={l} className="ox-pill ox-pill-neutral">{l}</span>)}
        </div>
      );
      if (!canUpdate) return badge;
      return (
        <Popover trigger={badge}>
          {(close) => (
            <>
              {options.map((o) => {
                const active = selected.has(o.id);
                return (
                  <PopoverOption
                    key={o.id}
                    active={active}
                    onClick={() => {
                      const next = new Set(selected);
                      if (active) next.delete(o.id);
                      else next.add(o.id);
                      commit(Array.from(next));
                    }}
                  >
                    {active ? "✓ " : ""}
                    {o.label}
                  </PopoverOption>
                );
              })}
              <div className="px-3 pt-1">
                <button type="button" onClick={close} className="text-[11px] text-[var(--text-muted)]">Done</button>
              </div>
            </>
          )}
        </Popover>
      );
    }
    case "person": {
      const current = members.find((m) => m.id === value);
      const badge = <span className="text-[12px] text-[var(--text-secondary)]">{current?.name ?? "—"}</span>;
      if (!canUpdate) return badge;
      return (
        <Popover trigger={badge}>
          {(close) => (
            <>
              <PopoverOption onClick={() => { commit(null); close(); }}>—</PopoverOption>
              {members.map((m) => (
                <PopoverOption key={m.id} active={m.id === value} onClick={() => { commit(m.id); close(); }}>
                  {m.name}
                </PopoverOption>
              ))}
            </>
          )}
        </Popover>
      );
    }
    case "number":
      return (
        <InlineTextCell
          value={value == null ? null : String(value)}
          canUpdate={canUpdate}
          onCommit={(next) => commit(next.trim() === "" ? null : Number(next))}
        />
      );
    case "date":
      return (
        <InlineTextCell
          value={value as string | null}
          isDate
          canUpdate={canUpdate}
          onCommit={(next) => commit(next || null)}
        />
      );
    case "url":
    case "email":
    case "phone":
    case "text":
    default:
      return (
        <InlineTextCell
          value={(value as string | null) ?? null}
          canUpdate={canUpdate}
          onCommit={(next) => commit(next || null)}
        />
      );
  }
}
