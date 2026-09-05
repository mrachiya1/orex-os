import { describe, it, expect } from "vitest";
import { buildMilestoneTree, projectLevelTasks, type FlatMilestone, type FlatTask } from "./milestone-tree";

function milestone(id: string, parent: string | null, sequence = 0): FlatMilestone {
  return { id, parent_milestone_id: parent, title: id, status: "pending", is_blocking: false, due_date: null, sequence };
}
function task(id: string, milestoneId: string | null, status: "todo" | "done" = "todo"): FlatTask {
  return { id, milestone_id: milestoneId, title: id, status, due_date: null, assignee_user_id: null };
}

describe("buildMilestoneTree", () => {
  it("nests children under their parent and leaves roots at the top", () => {
    const milestones = [milestone("root", null), milestone("child", "root"), milestone("grandchild", "child")];
    const tree = buildMilestoneTree(milestones, []);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("root");
    expect(tree[0].children[0].id).toBe("child");
    expect(tree[0].children[0].children[0].id).toBe("grandchild");
  });

  it("sorts siblings by sequence at every level", () => {
    const milestones = [milestone("root", null), milestone("b", "root", 2), milestone("a", "root", 1)];
    const tree = buildMilestoneTree(milestones, []);
    expect(tree[0].children.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("treats an orphaned parent reference (parent not in the fetched set) as a root", () => {
    const milestones = [milestone("orphan", "does-not-exist")];
    const tree = buildMilestoneTree(milestones, []);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("computes progress recursively across a milestone's own tasks and its descendants' tasks", () => {
    const milestones = [milestone("root", null), milestone("child", "root")];
    const tasks = [task("t1", "root", "done"), task("t2", "root"), task("t3", "child", "done"), task("t4", "child")];
    const tree = buildMilestoneTree(milestones, tasks);
    expect(tree[0].progress).toEqual({ done: 2, total: 4 });
    expect(tree[0].children[0].progress).toEqual({ done: 1, total: 2 });
  });
});

describe("projectLevelTasks", () => {
  it("returns only tasks with no milestone_id", () => {
    const tasks = [task("t1", null), task("t2", "m1")];
    expect(projectLevelTasks(tasks).map((t) => t.id)).toEqual(["t1"]);
  });
});
