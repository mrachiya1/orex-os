export interface FlatMilestone {
  id: string;
  parent_milestone_id: string | null;
  title: string;
  status: string;
  is_blocking: boolean;
  due_date: string | null;
  sequence: number;
}

export interface FlatTask {
  id: string;
  milestone_id: string | null;
  title: string;
  status: string;
  due_date: string | null;
  assignee_user_id: string | null;
}

export interface MilestoneNode extends FlatMilestone {
  children: MilestoneNode[];
  tasks: FlatTask[];
  /** Recursive completion count across this node, its descendant milestones, and their tasks. */
  progress: { done: number; total: number };
}

/**
 * Builds the milestone tree from one flat fetch of a project's milestones +
 * tasks (a project realistically holds dozens of rows, not thousands, so a
 * single query plus client-side tree construction is simpler and avoids
 * N+1 round trips -- see prompts/007 section "Performance"). Never trusts
 * ordering from the database; sorts by `sequence` at every level.
 */
export function buildMilestoneTree(milestones: FlatMilestone[], tasks: FlatTask[]): MilestoneNode[] {
  const byId = new Map<string, MilestoneNode>();
  for (const m of milestones) {
    byId.set(m.id, { ...m, children: [], tasks: [], progress: { done: 0, total: 0 } });
  }

  const roots: MilestoneNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_milestone_id && byId.has(node.parent_milestone_id)) {
      byId.get(node.parent_milestone_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const task of tasks) {
    if (task.milestone_id && byId.has(task.milestone_id)) {
      byId.get(task.milestone_id)!.tasks.push(task);
    }
  }

  const sortRec = (nodes: MilestoneNode[]) => {
    nodes.sort((a, b) => a.sequence - b.sequence);
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);

  const computeProgress = (node: MilestoneNode): { done: number; total: number } => {
    let done = node.tasks.filter((t) => t.status === "done").length;
    let total = node.tasks.length;
    for (const child of node.children) {
      const childProgress = computeProgress(child);
      done += childProgress.done;
      total += childProgress.total;
    }
    node.progress = { done, total };
    return node.progress;
  };
  for (const root of roots) computeProgress(root);

  return roots;
}

/** Unassigned tasks (milestone_id null) belong directly to the project. */
export function projectLevelTasks(tasks: FlatTask[]): FlatTask[] {
  return tasks.filter((t) => !t.milestone_id);
}
