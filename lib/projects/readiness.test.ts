import { describe, it, expect } from "vitest";
import { checkProjectReadiness } from "./readiness";

function mockChain(result: { data: unknown[] | null; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq"];
  for (const m of methods) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: typeof result) => void) => resolve(result);
  return chain;
}

function makeSupabaseMock(results: Record<string, { data: unknown[] | null; error: { message: string } | null }>) {
  return {
    from: (table: string) => mockChain(results[table] ?? { data: [], error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("checkProjectReadiness", () => {
  it("is ready when nothing is outstanding", async () => {
    const supabase = makeSupabaseMock({
      project_readiness_checks: { data: [], error: null },
      project_milestones: { data: [], error: null },
      project_scope_changes: { data: [], error: null },
      project_deliverables: { data: [], error: null },
    });

    const result = await checkProjectReadiness(supabase, "project-1");
    expect(result.ready).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("reports an incomplete required readiness check", async () => {
    const supabase = makeSupabaseMock({
      project_readiness_checks: {
        data: [{ id: "chk-1", title: "QA complete", is_required: true, status: "pending" }],
        error: null,
      },
      project_milestones: { data: [], error: null },
      project_scope_changes: { data: [], error: null },
      project_deliverables: { data: [], error: null },
    });

    const result = await checkProjectReadiness(supabase, "project-1");
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual([{ type: "readiness_check", id: "chk-1", title: "QA complete" }]);
  });

  it("reports an incomplete blocking milestone", async () => {
    const supabase = makeSupabaseMock({
      project_readiness_checks: { data: [], error: null },
      project_milestones: {
        data: [{ id: "m-1", title: "Client review", is_blocking: true, status: "in_progress" }],
        error: null,
      },
      project_scope_changes: { data: [], error: null },
      project_deliverables: { data: [], error: null },
    });

    const result = await checkProjectReadiness(supabase, "project-1");
    expect(result.ready).toBe(false);
    expect(result.missing[0]).toMatchObject({ type: "milestone", id: "m-1" });
  });

  it("reports a pending blocking scope change", async () => {
    const supabase = makeSupabaseMock({
      project_readiness_checks: { data: [], error: null },
      project_milestones: { data: [], error: null },
      project_scope_changes: {
        data: [{ id: "sc-1", summary: "Client requested extra revision", is_blocking: true, approval_state: "pending" }],
        error: null,
      },
      project_deliverables: { data: [], error: null },
    });

    const result = await checkProjectReadiness(supabase, "project-1");
    expect(result.ready).toBe(false);
    expect(result.missing[0]).toMatchObject({ type: "scope_change", id: "sc-1" });
  });

  it("reports an unapproved required deliverable", async () => {
    const supabase = makeSupabaseMock({
      project_readiness_checks: { data: [], error: null },
      project_milestones: { data: [], error: null },
      project_scope_changes: { data: [], error: null },
      project_deliverables: {
        data: [{ id: "d-1", title: "Final render", is_required: true, approval_state: "pending" }],
        error: null,
      },
    });

    const result = await checkProjectReadiness(supabase, "project-1");
    expect(result.ready).toBe(false);
    expect(result.missing[0]).toMatchObject({ type: "deliverable", id: "d-1" });
  });

  it("aggregates multiple simultaneous failures", async () => {
    const supabase = makeSupabaseMock({
      project_readiness_checks: {
        data: [{ id: "chk-1", title: "Naming correct", is_required: true, status: "pending" }],
        error: null,
      },
      project_milestones: {
        data: [{ id: "m-1", title: "Client review", is_blocking: true, status: "pending" }],
        error: null,
      },
      project_scope_changes: { data: [], error: null },
      project_deliverables: {
        data: [{ id: "d-1", title: "Final render", is_required: true, approval_state: "rejected" }],
        error: null,
      },
    });

    const result = await checkProjectReadiness(supabase, "project-1");
    expect(result.ready).toBe(false);
    expect(result.missing).toHaveLength(3);
  });

  it("propagates a database error rather than silently reporting ready", async () => {
    const supabase = makeSupabaseMock({
      project_readiness_checks: { data: null, error: { message: "boom" } },
      project_milestones: { data: [], error: null },
      project_scope_changes: { data: [], error: null },
      project_deliverables: { data: [], error: null },
    });

    await expect(checkProjectReadiness(supabase, "project-1")).rejects.toThrow("boom");
  });
});
