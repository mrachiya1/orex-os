"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { setMyProjectView } from "@/app/actions/project-views";
import { getProjectMilestoneSummary } from "@/app/actions/projects";
import { compareByUrgency, urgencyBadge } from "@/lib/projects/urgency";
import { SYSTEM_PROPERTIES, DEFAULT_VISIBLE_COLUMNS, DEFAULT_COLUMN_ORDER } from "@/lib/projects/system-properties";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconProjects, IconChevronDown } from "@/components/ui/icons";
import { PropertiesPanel } from "./PropertiesPanel";
import { AddPropertyMenu } from "./AddPropertyMenu";
import { FolderTree, type FolderRow } from "./FolderTree";
import { NewMenu } from "./NewMenu";
import { MilestoneTree } from "@/components/projects/MilestoneTree";
import {
  StatusCell,
  PriorityCell,
  HealthCell,
  AssignedCell,
  ClientCell,
  CategoryCell,
  DateCell,
  NextTaskCell,
  CustomPropertyCell,
  FolderCell,
} from "./Cells";
import type { ProjectStatus, ProjectHealthState, ProjectPriority } from "@/lib/projects/types";
import type { PropertyType } from "@/lib/projects/property-types";
import type { FlatMilestone, FlatTask } from "@/lib/projects/milestone-tree";

export interface DbProjectRow {
  id: string;
  name: string;
  description: string | null;
  project_code: string;
  project_type: string;
  status: ProjectStatus;
  health_state: ProjectHealthState;
  priority: ProjectPriority;
  target_date: string | null;
  start_date: string | null;
  client_display_name: string | null;
  lead_id: string | null;
  folder_id: string | null;
  updated_at: string;
}

export interface DbPropertyDefinition {
  id: string;
  name: string;
  property_type: PropertyType;
  configuration: { options?: Array<{ id: string; label: string }> };
}

export function ProjectDatabase({
  companySlug,
  companyId,
  organisationId,
  projects,
  members,
  folders,
  propertyDefinitions,
  propertyValues,
  nextTaskByProject,
  requestCountByProject,
  initialView,
  canUpdate,
  canCreate,
}: {
  companySlug: string;
  companyId: string;
  organisationId: string;
  projects: DbProjectRow[];
  members: { id: string; name: string }[];
  folders: FolderRow[];
  propertyDefinitions: DbPropertyDefinition[];
  propertyValues: Record<string, Record<string, unknown>>;
  nextTaskByProject: Record<string, { title: string; due_date: string | null } | null>;
  requestCountByProject: Record<string, number>;
  initialView: { visibleColumns: string[]; order: string[] } | null;
  canUpdate: boolean;
  canCreate: boolean;
}) {
  const [selectedFolder, setSelectedFolder] = useState<string | "unfiled" | "all">("all");
  const allKeys = useMemo(
    () => [...DEFAULT_COLUMN_ORDER, ...propertyDefinitions.map((p) => p.id)],
    [propertyDefinitions]
  );

  const [order, setOrder] = useState<string[]>(() => {
    const base = initialView?.order?.length ? initialView.order : DEFAULT_COLUMN_ORDER;
    const missing = allKeys.filter((k) => !base.includes(k));
    return [...base, ...missing];
  });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    initialView?.visibleColumns?.length ? initialView.visibleColumns : DEFAULT_VISIBLE_COLUMNS
  );
  const [expanded, setExpanded] = useState<Record<string, { milestones: FlatMilestone[]; tasks: FlatTask[] } | "loading" | undefined>>({});

  function persist(nextOrder: string[], nextVisible: string[]) {
    setMyProjectView({ organisationId, companyId, configuration: { order: nextOrder, visibleColumns: nextVisible } }).catch(() => {});
  }

  function toggle(key: string) {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      persist(order, next);
      return next;
    });
  }

  function move(key: string, direction: "up" | "down") {
    setOrder((prev) => {
      const idx = prev.indexOf(key);
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      persist(next, visibleColumns);
      return next;
    });
  }

  async function toggleExpand(projectId: string) {
    setExpanded((prev) => {
      if (prev[projectId]) {
        const { [projectId]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      }
      return { ...prev, [projectId]: "loading" };
    });
    if (!expanded[projectId]) {
      const summary = await getProjectMilestoneSummary(projectId);
      setExpanded((prev) => (prev[projectId] === "loading" ? { ...prev, [projectId]: summary as { milestones: FlatMilestone[]; tasks: FlatTask[] } } : prev));
    }
  }

  const folderFiltered = useMemo(() => {
    if (selectedFolder === "all") return projects;
    if (selectedFolder === "unfiled") return projects.filter((p) => !p.folder_id);
    return projects.filter((p) => p.folder_id === selectedFolder);
  }, [projects, selectedFolder]);

  const sortedProjects = useMemo(
    () =>
      [...folderFiltered].sort((a, b) =>
        compareByUrgency(
          { status: a.status, priority: a.priority, targetDate: a.target_date, healthState: a.health_state },
          { status: b.status, priority: b.priority, targetDate: b.target_date, healthState: b.health_state }
        )
      ),
    [folderFiltered]
  );
  const visibleOrder = order.filter((k) => visibleColumns.includes(k));

  const categorySuggestions = useMemo(() => Array.from(new Set(projects.map((p) => p.project_type))).sort(), [projects]);
  const customById = useMemo(() => new Map(propertyDefinitions.map((p) => [p.id, p])), [propertyDefinitions]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      if (p.folder_id) counts[p.folder_id] = (counts[p.folder_id] ?? 0) + 1;
    }
    return counts;
  }, [projects]);
  const unfiledCount = projects.filter((p) => !p.folder_id).length;

  if (projects.length === 0 && folders.length === 0) {
    return (
      <EmptyState
        icon={<IconProjects width={16} height={16} />}
        title="No projects yet."
        body="Create the first project to start tracking delivery for this company."
      />
    );
  }

  return (
    <div className="flex">
      <FolderTree
        folders={folders}
        counts={folderCounts}
        totalCount={projects.length}
        unfiledCount={unfiledCount}
        selected={selectedFolder}
        onSelect={setSelectedFolder}
        organisationId={organisationId}
        companyId={companyId}
        canUpdate={canUpdate}
      />

      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="flex items-center justify-end gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
          <PropertiesPanel
            systemProperties={SYSTEM_PROPERTIES}
            customProperties={propertyDefinitions}
            order={order}
            visibleColumns={visibleColumns}
            onToggle={toggle}
            onMove={move}
            companyId={companyId}
          />
          {canUpdate && <AddPropertyMenu organisationId={organisationId} companyId={companyId} onCreated={() => {}} />}
          {canCreate && (
            <NewMenu
              organisationId={organisationId}
              companyId={companyId}
              companySlug={companySlug}
              folderId={typeof selectedFolder === "string" && selectedFolder !== "all" && selectedFolder !== "unfiled" ? selectedFolder : undefined}
            />
          )}
        </div>

        {sortedProjects.length === 0 ? (
          <EmptyState icon={<IconProjects width={16} height={16} />} title="No projects in this folder." />
        ) : (
        <table className="ox-table">
          <thead>
            <tr>
              <th style={{ width: 24 }} />
              {visibleOrder.map((key) => (
                <th key={key}>{columnLabel(key, customById)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((p) => {
            const badge = urgencyBadge({ status: p.status, priority: p.priority, targetDate: p.target_date, healthState: p.health_state });
            const exp = expanded[p.id];
            return (
              <Fragment key={p.id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleExpand(p.id)}
                      aria-label={exp ? "Collapse" : "Expand"}
                      className="ox-focus-ring grid h-5 w-5 place-items-center text-[var(--text-muted)]"
                    >
                      <IconChevronDown width={11} height={11} style={{ transform: exp ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .12s" }} />
                    </button>
                  </td>
                  {visibleOrder.map((key) => (
                    <td key={key}>
                      {renderCell(key, p, {
                        companySlug,
                        members,
                        folders,
                        canUpdate,
                        categorySuggestions,
                        nextTask: nextTaskByProject[p.id] ?? null,
                        requestCount: requestCountByProject[p.id] ?? 0,
                        badge,
                        customById,
                        propertyValues: propertyValues[p.id] ?? {},
                      })}
                    </td>
                  ))}
                </tr>
                {exp && (
                  <tr>
                    <td />
                    <td colSpan={visibleOrder.length} className="bg-[var(--surface-sunken)] !py-3">
                      {exp === "loading" ? (
                        <p className="text-[11px] text-[var(--text-muted)]">Loading…</p>
                      ) : (
                        <MilestoneTree projectId={p.id} milestones={exp.milestones} tasks={exp.tasks} canUpdate={canUpdate} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

function columnLabel(key: string, customById: Map<string, DbPropertyDefinition>) {
  const sys = SYSTEM_PROPERTIES.find((s) => s.key === key);
  if (sys) return sys.label;
  return customById.get(key)?.name ?? key;
}

function renderCell(
  key: string,
  p: DbProjectRow,
  ctx: {
    companySlug: string;
    members: { id: string; name: string }[];
    folders: FolderRow[];
    canUpdate: boolean;
    categorySuggestions: string[];
    nextTask: { title: string; due_date: string | null } | null;
    requestCount: number;
    badge: string | null;
    customById: Map<string, DbPropertyDefinition>;
    propertyValues: Record<string, unknown>;
  }
) {
  switch (key) {
    case "project":
      return (
        <div className="flex min-w-[260px] items-start gap-2.5 py-1">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-s)] border border-[var(--border-medium)] bg-[var(--surface-raised)] text-[var(--text-muted)]">
            <IconProjects width={16} height={16} />
          </div>
          <div className="min-w-0">
            <Link href={`/${ctx.companySlug}/projects/${p.id}`} className="ox-focus-ring block truncate font-semibold text-[var(--text-primary)] hover:underline">
              {p.name}
            </Link>
            {p.description && <div className="truncate text-[11px] text-[var(--text-muted)]">{p.description}</div>}
            <div className="mt-0.5 flex items-center gap-2">
              <span className="num text-[10.5px] text-[var(--text-muted)]">
                {p.client_display_name ? `${p.client_display_name} · ` : ""}
                {p.project_code}
              </span>
              {ctx.badge && <span className={`ox-pill ${ctx.badge === "OVERDUE" ? "ox-pill-danger" : ctx.badge === "TODAY" ? "ox-pill-warning" : "ox-pill-info"}`}>{ctx.badge}</span>}
            </div>
          </div>
        </div>
      );
    case "category":
      return <CategoryCell projectId={p.id} projectType={p.project_type} canUpdate={ctx.canUpdate} suggestions={ctx.categorySuggestions} />;
    case "assigned":
      return <AssignedCell projectId={p.id} leadId={p.lead_id} members={ctx.members} canUpdate={ctx.canUpdate} />;
    case "status":
      return <StatusCell projectId={p.id} status={p.status} canUpdate={ctx.canUpdate} />;
    case "health":
      return <HealthCell projectId={p.id} health={p.health_state} canUpdate={ctx.canUpdate} />;
    case "priority":
      return <PriorityCell projectId={p.id} priority={p.priority} canUpdate={ctx.canUpdate} />;
    case "deadline":
      return <DateCell projectId={p.id} field="targetDate" value={p.target_date} canUpdate={ctx.canUpdate} />;
    case "start_date":
      return <DateCell projectId={p.id} field="startDate" value={p.start_date} canUpdate={ctx.canUpdate} />;
    case "client":
      return <ClientCell projectId={p.id} clientDisplayName={p.client_display_name} canUpdate={ctx.canUpdate} />;
    case "next_task":
      return <NextTaskCell task={ctx.nextTask} />;
    case "updated":
      return <span className="num text-[12px] text-[var(--text-muted)]">{new Date(p.updated_at).toLocaleDateString()}</span>;
    case "folder":
      return <FolderCell projectId={p.id} folderId={p.folder_id} folders={ctx.folders} canUpdate={ctx.canUpdate} />;
    case "client_requests":
      return ctx.requestCount > 0 ? (
        <Link href={`/${ctx.companySlug}/projects/${p.id}/scope`} className="ox-focus-ring ox-pill ox-pill-neutral hover:text-[var(--text-primary)]">
          {ctx.requestCount}
        </Link>
      ) : (
        <span className="text-[12px] text-[var(--text-muted)]">—</span>
      );
    default: {
      const def = ctx.customById.get(key);
      if (!def) return <span className="text-[12px] text-[var(--text-muted)]">—</span>;
      return (
        <CustomPropertyCell
          projectId={p.id}
          propertyDefinitionId={def.id}
          propertyType={def.property_type}
          configuration={def.configuration}
          value={ctx.propertyValues[def.id]}
          members={ctx.members}
          canUpdate={ctx.canUpdate}
        />
      );
    }
  }
}
