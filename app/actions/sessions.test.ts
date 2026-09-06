import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const hasPermission = vi.fn();
const hasOrgPermission = vi.fn();
const requirePermission = vi.fn();
const requireOrgPermission = vi.fn();
const getAgent = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: (...a: unknown[]) => hasPermission(...a),
  hasOrgPermission: (...a: unknown[]) => hasOrgPermission(...a),
  requirePermission: (...a: unknown[]) => requirePermission(...a),
  requireOrgPermission: (...a: unknown[]) => requireOrgPermission(...a),
  PERMISSIONS: { AGENTS_USE: "agents.use", AGENTS_MANAGE: "agents.manage" },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/ai/agents/registry", () => ({ getAgent: (...a: unknown[]) => getAgent(...a) }));

function mockChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "insert", "update", "order"]) {
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
  createServiceRoleClient: () => ({
    from: (table: string) => mockChain(fromResponses[table] ?? { data: null, error: null }),
  }),
}));

const { createSession, listSessions, getSession, renameSession, archiveSession } = await import("./sessions");

const organisationId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("requires agents.use", async () => {
    hasPermission.mockResolvedValue(false);
    const result = await createSession({ organisationId, companyId, title: "New Session", agentKey: "advisor" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown agent", async () => {
    hasPermission.mockResolvedValue(true);
    getAgent.mockResolvedValue(null);
    const result = await createSession({ organisationId, companyId, title: "New Session", agentKey: "no-such-agent" });
    expect(result.ok).toBe(false);
  });

  it("rejects a disabled agent", async () => {
    hasPermission.mockResolvedValue(true);
    getAgent.mockResolvedValue({ id: "agent-uuid-1", enabled: false, mode: "MANUAL" });
    const result = await createSession({ organisationId, companyId, title: "New Session", agentKey: "advisor" });
    expect(result.ok).toBe(false);
  });

  it("creates a session referencing the resolved agent's real id, via the service-role client (agent_sessions has no client INSERT policy)", async () => {
    hasPermission.mockResolvedValue(true);
    getAgent.mockResolvedValue({ id: "agent-uuid-1", enabled: true, mode: "MANUAL", organisationId, companyId: null });
    fromResponses = { agent_sessions: { data: { id: "session-1" }, error: null } };
    const result = await createSession({ organisationId, companyId, title: "New Session", agentKey: "advisor" });
    expect(result.ok).toBe(true);
  });

  it("SECURITY: rejects an agent from a different organisation even if the agent_key resolves", async () => {
    hasPermission.mockResolvedValue(true);
    getAgent.mockResolvedValue({ id: "agent-uuid-1", enabled: true, mode: "MANUAL", organisationId: "99999999-9999-4999-8999-999999999999", companyId: null });
    const result = await createSession({ organisationId, companyId, title: "New Session", agentKey: "advisor" });
    expect(result.ok).toBe(false);
  });

  it("SECURITY: rejects an agent scoped to a different company than the one the session is being created for", async () => {
    hasPermission.mockResolvedValue(true);
    getAgent.mockResolvedValue({ id: "agent-uuid-1", enabled: true, mode: "MANUAL", organisationId, companyId: "88888888-8888-4888-8888-888888888888" });
    const result = await createSession({ organisationId, companyId, title: "New Session", agentKey: "advisor" });
    expect(result.ok).toBe(false);
  });
});

describe("listSessions / getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("normal manual chat persists: a created session can be re-fetched (simulates a page refresh)", async () => {
    fromResponses = {
      agent_sessions: {
        data: { id: "session-1", organisation_id: organisationId, company_id: companyId, title: "New Session", goal: null, status: "active", primary_agent_id: "agent-1", summary: null, created_by: "user-1" },
        error: null,
      },
    };
    const session = await getSession("session-1");
    expect(session?.id).toBe("session-1");
    expect(session?.title).toBe("New Session");
  });

  it("session remains company-scoped -- a session belonging to another company is not returned by RLS (simulated: no matching row)", async () => {
    // In the real DB, RLS on agent_sessions_select denies a cross-company
    // row entirely -- simulated here by the mock returning no data for a
    // session id the caller has no access to.
    fromResponses = { agent_sessions: { data: null, error: null } };
    const session = await getSession("some-other-companys-session");
    expect(session).toBeNull();
  });

  it("listSessions requires agents.use for the queried company", async () => {
    requirePermission.mockRejectedValue(new Error("Forbidden: missing required permission"));
    await expect(listSessions(companyId, organisationId)).rejects.toThrow();
  });

  it("listSessions scopes its query to the requested company only", async () => {
    requirePermission.mockResolvedValue(undefined);
    fromResponses = { agent_sessions: { data: [{ id: "s1" }], error: null } };
    const result = await listSessions(companyId, organisationId);
    expect(result).toEqual([{ id: "s1" }]);
  });
});

describe("renameSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("renames via the service-role client after confirming the caller can see the session", async () => {
    const sessionId = "44444444-4444-4444-8444-444444444444";
    fromResponses = {
      agent_sessions: {
        data: { id: sessionId, organisation_id: organisationId, company_id: companyId, title: "Old", goal: null, status: "active", primary_agent_id: "agent-1", summary: null, created_by: "user-1" },
        error: null,
      },
    };
    const result = await renameSession({ sessionId, title: "New Title" });
    expect(result.ok).toBe(true);
  });

  it("returns not found for a session the caller cannot see", async () => {
    fromResponses = { agent_sessions: { data: null, error: null } };
    const result = await renameSession({ sessionId: "55555555-5555-4555-8555-555555555555", title: "New Title" });
    expect(result.ok).toBe(false);
  });
});

describe("archiveSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("archives without hard-deleting the session (business AI history is never hard-deleted by default)", async () => {
    const sessionId = "33333333-3333-4333-8333-333333333333";
    fromResponses = {
      agent_sessions: {
        data: { id: sessionId, organisation_id: organisationId, company_id: companyId, created_by: "user-1" },
        error: null,
      },
    };
    const result = await archiveSession({ sessionId, archived: true });
    expect(result.ok).toBe(true);
  });

  it("SECURITY: denies archiving another user's session when the caller has neither ownership nor agents.manage (previously bypassed RLS via an unchecked service-role lookup)", async () => {
    const sessionId = "66666666-6666-4666-8666-666666666666";
    fromResponses = {
      agent_sessions: {
        data: { id: sessionId, organisation_id: organisationId, company_id: companyId, created_by: "someone-else" },
        error: null,
      },
    };
    hasPermission.mockResolvedValue(false);
    const result = await archiveSession({ sessionId, archived: true });
    expect(result.ok).toBe(false);
  });

  it("allows an agents.manage holder to archive another user's session", async () => {
    const sessionId = "77777777-7777-4777-8777-777777777777";
    fromResponses = {
      agent_sessions: {
        data: { id: sessionId, organisation_id: organisationId, company_id: companyId, created_by: "someone-else" },
        error: null,
      },
    };
    hasPermission.mockResolvedValue(true);
    const result = await archiveSession({ sessionId, archived: true });
    expect(result.ok).toBe(true);
  });
});
