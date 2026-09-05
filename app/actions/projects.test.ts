import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const requireScopedPermission = vi.fn();
const requireProjectAccess = vi.fn();
const writeAuditLog = vi.fn();
const writeProjectActivity = vi.fn();
const checkProjectReadiness = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  requireScopedPermission: (...a: unknown[]) => requireScopedPermission(...a),
  requireProjectAccess: (...a: unknown[]) => requireProjectAccess(...a),
  PERMISSIONS: {
    PROJECTS_CREATE: "projects.create",
    PROJECTS_READ: "projects.read",
    PROJECTS_UPDATE: "projects.update",
    PROJECTS_APPROVE: "projects.approve",
    PROJECTS_ASSIGN: "projects.assign",
  },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/projects/activity", () => ({
  writeProjectActivity: (...a: unknown[]) => writeProjectActivity(...a),
}));
vi.mock("@/lib/projects/readiness", async () => {
  const actual = await vi.importActual<typeof import("@/lib/projects/readiness")>("@/lib/projects/readiness");
  return {
    ...actual,
    checkProjectReadiness: (...a: unknown[]) => checkProjectReadiness(...a),
  };
});

// A minimal, per-test-configurable chainable query builder mock.
function mockChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "insert", "update"]) {
    chain[m] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(result);
  chain.single = () => Promise.resolve(result);
  chain.then = (resolve: (v: typeof result) => void) => resolve(result);
  return chain;
}

let fromResponses: Record<string, { data: unknown; error: { message: string } | null }> = {};
vi.mock("@/lib/database/server", () => ({
  createServerSupabaseClient: async () => ({
    from: (table: string) => mockChain(fromResponses[table] ?? { data: null, error: null }),
  }),
}));

const { changeProjectStatus, markDeliveryReady } = await import("./projects");

const projectId = "11111111-1111-4111-8111-111111111111";

describe("changeProjectStatus", () => {
  beforeEach(() => {
    requireCurrentUser.mockReset().mockResolvedValue({ id: "user-1" });
    requireProjectAccess.mockReset().mockResolvedValue(undefined);
    writeAuditLog.mockReset();
    writeProjectActivity.mockReset();
    fromResponses = {
      projects: { data: { organisation_id: "org-1", company_id: "company-1", status: "active" }, error: null },
    };
  });

  it("rejects an invalid transition before touching permissions or the database write", async () => {
    fromResponses.projects = { data: { organisation_id: "org-1", company_id: "company-1", status: "draft" }, error: null };
    await expect(
      changeProjectStatus({ projectId, targetStatus: "active" }) // draft -> active skips planned
    ).rejects.toThrow(/Cannot transition/);
  });

  it("refuses to reach delivery_ready through the generic status-change path", async () => {
    await expect(changeProjectStatus({ projectId, targetStatus: "delivery_ready" })).rejects.toThrow(
      /markDeliveryReady/
    );
    expect(requireProjectAccess).not.toHaveBeenCalled();
  });

  it("requires projects.approve in addition to projects.update for the 'completed' transition", async () => {
    fromResponses.projects = { data: { organisation_id: "org-1", company_id: "company-1", status: "delivered" }, error: null };
    await changeProjectStatus({ projectId, targetStatus: "completed" });
    const calledPerms = requireProjectAccess.mock.calls.map((c) => c[1]);
    expect(calledPerms).toContain("projects.update");
    expect(calledPerms).toContain("projects.approve");
  });

  it("only requires projects.update for an ordinary transition (e.g. active -> on_hold)", async () => {
    await changeProjectStatus({ projectId, targetStatus: "on_hold" });
    const calledPerms = requireProjectAccess.mock.calls.map((c) => c[1]);
    expect(calledPerms).toEqual(["projects.update"]);
  });

  it("blocks the 'delivered' transition when no delivery has been recorded", async () => {
    fromResponses.projects = { data: { organisation_id: "org-1", company_id: "company-1", status: "delivery_ready" }, error: null };
    fromResponses.project_deliverables = { data: [], error: null };
    await expect(changeProjectStatus({ projectId, targetStatus: "delivered" })).rejects.toThrow(
      /no recorded deliveries/
    );
  });

  it("writes both an audit log and a project_activity row on a successful transition", async () => {
    await changeProjectStatus({ projectId, targetStatus: "on_hold" });
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    expect(writeProjectActivity).toHaveBeenCalledTimes(1);
    expect(writeAuditLog.mock.calls[0][0]).toMatchObject({ action: "project.status_changed" });
  });

  it("labels the audit action project.archived when transitioning into archived", async () => {
    fromResponses.projects = { data: { organisation_id: "org-1", company_id: "company-1", status: "completed" }, error: null };
    await changeProjectStatus({ projectId, targetStatus: "archived" });
    expect(writeAuditLog.mock.calls[0][0]).toMatchObject({ action: "project.archived" });
  });
});

describe("markDeliveryReady", () => {
  beforeEach(() => {
    requireCurrentUser.mockReset().mockResolvedValue({ id: "user-1" });
    requireProjectAccess.mockReset().mockResolvedValue(undefined);
    checkProjectReadiness.mockReset();
    writeAuditLog.mockReset();
    writeProjectActivity.mockReset();
    fromResponses = {
      projects: { data: { organisation_id: "org-1", company_id: "company-1", status: "active" }, error: null },
    };
  });

  it("requires both projects.update and projects.approve", async () => {
    checkProjectReadiness.mockResolvedValue({ ready: true, missing: [] });
    await markDeliveryReady({ projectId });
    const calledPerms = requireProjectAccess.mock.calls.map((c) => c[1]);
    expect(calledPerms).toContain("projects.update");
    expect(calledPerms).toContain("projects.approve");
  });

  it("rejects with a typed, specific error listing what's missing when readiness fails", async () => {
    checkProjectReadiness.mockResolvedValue({
      ready: false,
      missing: [{ type: "milestone", id: "m-1", title: "Client review" }],
    });
    await expect(markDeliveryReady({ projectId })).rejects.toThrow(/Client review/);
  });

  it("never writes the status change when readiness fails", async () => {
    checkProjectReadiness.mockResolvedValue({
      ready: false,
      missing: [{ type: "deliverable", id: "d-1", title: "Final render" }],
    });
    await expect(markDeliveryReady({ projectId })).rejects.toThrow();
    expect(writeAuditLog).not.toHaveBeenCalled();
    expect(writeProjectActivity).not.toHaveBeenCalled();
  });

  it("succeeds and records activity/audit when all readiness conditions are met", async () => {
    checkProjectReadiness.mockResolvedValue({ ready: true, missing: [] });
    await markDeliveryReady({ projectId });
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    expect(writeProjectActivity).toHaveBeenCalledTimes(1);
    expect(writeProjectActivity.mock.calls[0][0]).toMatchObject({ eventType: "delivery_ready" });
  });
});
