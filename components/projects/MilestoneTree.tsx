"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMilestone, updateMilestone } from "@/app/actions/project-milestones";
import { createTask } from "@/app/actions/project-tasks";
import { updateTaskStatus } from "@/app/actions/project-tasks";
import { buildMilestoneTree, projectLevelTasks, type FlatMilestone, type FlatTask, type MilestoneNode } from "@/lib/projects/milestone-tree";
import { IconPlus, IconChevronDown } from "@/components/ui/icons";

export function MilestoneTree({
  projectId,
  milestones,
  tasks,
  canUpdate,
}: {
  projectId: string;
  milestones: FlatMilestone[];
  tasks: FlatTask[];
  canUpdate: boolean;
}) {
  const tree = buildMilestoneTree(milestones, tasks);
  const rootTasks = projectLevelTasks(tasks);
  const [addingRoot, setAddingRoot] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      {tree.map((node) => (
        <MilestoneNodeRow key={node.id} node={node} projectId={projectId} depth={0} canUpdate={canUpdate} />
      ))}

      {rootTasks.length > 0 && (
        <div className="ml-1 mt-1 flex flex-col gap-0.5 border-l border-[var(--border-subtle)] pl-3">
          {rootTasks.map((t) => (
            <TaskRow key={t.id} task={t} projectId={projectId} canUpdate={canUpdate} />
          ))}
        </div>
      )}

      {canUpdate && (
        <div className="mt-1">
          {addingRoot ? (
            <InlineMilestoneForm
              projectId={projectId}
              parentMilestoneId={null}
              onDone={() => setAddingRoot(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingRoot(true)}
              className="ox-focus-ring flex items-center gap-1.5 rounded-[var(--radius-s)] px-2 py-1.5 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            >
              <IconPlus width={12} height={12} /> Add milestone
            </button>
          )}
        </div>
      )}

      {tree.length === 0 && rootTasks.length === 0 && (
        <p className="px-2 py-6 text-[12px] text-[var(--text-muted)]">No milestones yet.</p>
      )}
    </div>
  );
}

function MilestoneNodeRow({
  node,
  projectId,
  depth,
  canUpdate,
}: {
  node: MilestoneNode;
  projectId: string;
  depth: number;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(depth < 1);
  const [addingChild, setAddingChild] = useState<"milestone" | "task" | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasChildren = node.children.length > 0 || node.tasks.length > 0;

  function complete() {
    startTransition(async () => {
      await updateMilestone({ milestoneId: node.id, projectId, status: "completed" });
      router.refresh();
    });
  }

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-[var(--radius-s)] px-1.5 py-1.5 hover:bg-[var(--surface-2)]"
        style={{ paddingLeft: 6 + depth * 18 }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ox-focus-ring grid h-4 w-4 shrink-0 place-items-center text-[var(--text-muted)]"
          aria-label={expanded ? "Collapse" : "Expand"}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            <IconChevronDown
              width={12}
              height={12}
              style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .12s" }}
            />
          ) : (
            <span className="h-1 w-1 rounded-full bg-[var(--border-strong)]" />
          )}
        </button>

        <span
          className={
            depth === 0
              ? "text-[13px] font-semibold text-[var(--text-primary)]"
              : "text-[12.5px] font-medium text-[var(--text-secondary)]"
          }
        >
          {node.title}
        </span>

        {node.is_blocking && <span className="ox-pill ox-pill-warning">Blocking</span>}
        {node.status === "completed" && <span className="ox-pill ox-pill-success">Done</span>}
        {node.status === "blocked" && <span className="ox-pill ox-pill-danger">Blocked</span>}

        <span className="num ml-1 text-[10.5px] text-[var(--text-muted)]">
          {node.progress.done}/{node.progress.total}
        </span>

        {canUpdate && (
          <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setAddingChild("milestone")}
              className="ox-focus-ring text-[10.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              + Sub-milestone
            </button>
            <button
              type="button"
              onClick={() => setAddingChild("task")}
              className="ox-focus-ring text-[10.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              + Task
            </button>
            {node.status !== "completed" && (
              <button
                type="button"
                disabled={isPending}
                onClick={complete}
                className="ox-focus-ring text-[10.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Complete
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div style={{ paddingLeft: 6 + depth * 18 + 18 }} className="flex flex-col gap-0.5">
          {node.tasks.map((t) => (
            <TaskRow key={t.id} task={t} projectId={projectId} canUpdate={canUpdate} />
          ))}
          {node.children.map((child) => (
            <MilestoneNodeRow key={child.id} node={child} projectId={projectId} depth={depth + 1} canUpdate={canUpdate} />
          ))}
        </div>
      )}

      {addingChild === "milestone" && (
        <div style={{ paddingLeft: 6 + depth * 18 + 18 }}>
          <InlineMilestoneForm projectId={projectId} parentMilestoneId={node.id} onDone={() => setAddingChild(null)} />
        </div>
      )}
      {addingChild === "task" && (
        <div style={{ paddingLeft: 6 + depth * 18 + 18 }}>
          <InlineTaskForm projectId={projectId} milestoneId={node.id} onDone={() => setAddingChild(null)} />
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  projectId,
  canUpdate,
}: {
  task: FlatTask;
  projectId: string;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await updateTaskStatus({ taskId: task.id, projectId, status: task.status === "done" ? "todo" : "done" });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-s)] px-1.5 py-1 pl-[24px] hover:bg-[var(--surface-2)]">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending || !canUpdate}
        aria-label={task.status === "done" ? "Mark incomplete" : "Mark complete"}
        className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] border ${
          task.status === "done" ? "border-[var(--success)] bg-[var(--success)] text-[#08090a]" : "border-[var(--border-strong)]"
        }`}
      >
        {task.status === "done" && "✓"}
      </button>
      <span className={`text-[12px] ${task.status === "done" ? "text-[var(--text-muted)] line-through" : "text-[var(--text-secondary)]"}`}>
        {task.title}
      </span>
      {task.due_date && <span className="num ml-auto text-[10px] text-[var(--text-muted)]">{task.due_date}</span>}
    </div>
  );
}

function InlineMilestoneForm({
  projectId,
  parentMilestoneId,
  onDone,
}: {
  projectId: string;
  parentMilestoneId: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createMilestone({ projectId, parentMilestoneId: parentMilestoneId ?? undefined, title });
      setTitle("");
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-1">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={parentMilestoneId ? "Sub-milestone name" : "Milestone name"}
        className="ox-input h-8 w-64 text-[12px]"
        onKeyDown={(e) => e.key === "Escape" && onDone()}
      />
      <button type="submit" disabled={isPending} className="ox-btn ox-btn-secondary ox-btn-sm">
        Add
      </button>
      <button type="button" onClick={onDone} className="text-[11px] text-[var(--text-muted)]">
        Cancel
      </button>
    </form>
  );
}

function InlineTaskForm({
  projectId,
  milestoneId,
  onDone,
}: {
  projectId: string;
  milestoneId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createTask({ projectId, milestoneId, title });
      setTitle("");
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-1">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task name"
        className="ox-input h-8 w-64 text-[12px]"
        onKeyDown={(e) => e.key === "Escape" && onDone()}
      />
      <button type="submit" disabled={isPending} className="ox-btn ox-btn-secondary ox-btn-sm">
        Add
      </button>
      <button type="button" onClick={onDone} className="text-[11px] text-[var(--text-muted)]">
        Cancel
      </button>
    </form>
  );
}
