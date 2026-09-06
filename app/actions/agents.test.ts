import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const requirePermission = vi.fn();
const writeAuditLog = vi.fn();
const listAgentsFromRegistry = vi.fn();
const getGlobalAIControls = vi.fn();
const setGlobalAIControls = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...a: unknown[]) => requirePermission(...a),
  PERMISSIONS: {
    AGENTS_READ: "agents.read",
    AGENTS_USE: "agents.use",
    AGENTS_MANAGE: "agents.manage",
    AGENTS_ENABLE: "agents.enable",
    AGENTS_APPROVE: "agents.approve",
  },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/ai/agents/registry", () => ({
  listAgents: (...a: unknown[]) => listAgentsFromRegistry(...a),
  getAgent: vi.fn(),
}));
vi.mock("@/lib/ai/agents/global-controls", () => ({
  getGlobalAIControls: (...a: unknown[]) => getGlobalAIControls(...a),
  setGlobalAIControls: (...a: unknown[]) => setGlobalAIControls(...a),
}));

function mockChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "update", "upsert"]) {
    chain[m] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(result);
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

const { listAgents, setAgentEnabled, setAgentMode, updateGlobalControls } = await import("./agents");

const companyId = "11111111-1111-4111-8111-111111111111";

describe("listAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("requires agents.read", async () => {
    requirePermission.mockResolvedValue(undefined);
    listAgentsFromRegistry.mockResolvedValue([]);
    await listAgents(companyId);
    expect(requirePermission).toHaveBeenCalledWith(companyId, "agents.read");
  });

  it("a Viewer without agents.read is denied", async () => {
    requirePermission.mockRejectedValue(new Error("Forbidden: missing required permission"));
    await expect(listAgents(companyId)).rejects.toThrow();
  });
});

describe("setAgentEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    fromResponses = { agents: { data: { id: "agent-1", organisation_id: "org-1", company_id: null, enabled: true, mode: "MANUAL" }, error: null } };
  });

  it("requires agents.enable -- a Viewer cannot toggle an agent", async () => {
    requirePermission.mockRejectedValue(new Error("Forbidden: missing required permission"));
    const result = await setAgentEnabled({ companyId, agentKey: "advisor", enabled: false });
    expect(result.ok).toBe(false);
  });

  it("disables an agent and writes an audit log entry with the real before/after state (not null)", async () => {
    requirePermission.mockResolvedValue(undefined);
    const result = await setAgentEnabled({ companyId, agentKey: "advisor", enabled: false });
    expect(result.ok).toBe(true);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "agent.disabled",
        beforeState: { enabled: true, mode: "MANUAL" },
        afterState: { enabled: false, mode: "MANUAL" },
      })
    );
  });
});

describe("setAgentMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    fromResponses = { agents: { data: { id: "agent-1", organisation_id: "org-1", enabled: true, mode: "OFF" }, error: null } };
  });

  it("agent management requires agents.manage", async () => {
    requirePermission.mockRejectedValue(new Error("Forbidden: missing required permission"));
    const result = await setAgentMode({ companyId, agentKey: "advisor", mode: "OFF" });
    expect(result.ok).toBe(false);
  });

  it("sets the mode when authorized", async () => {
    requirePermission.mockResolvedValue(undefined);
    const result = await setAgentMode({ companyId, agentKey: "advisor", mode: "AUTO_SAFE" });
    expect(result.ok).toBe(true);
  });

  it("records the real previous mode as before_state, not null (audit completeness fix)", async () => {
    requirePermission.mockResolvedValue(undefined);
    const result = await setAgentMode({ companyId, agentKey: "advisor", mode: "MANUAL" });
    expect(result.ok).toBe(true);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "agent.mode_changed",
        beforeState: { enabled: true, mode: "OFF" },
        afterState: { enabled: true, mode: "MANUAL" },
      })
    );
  });
});

describe("updateGlobalControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("requires agents.manage to pause all agents", async () => {
    requirePermission.mockRejectedValue(new Error("Forbidden: missing required permission"));
    const result = await updateGlobalControls({ companyId, paused: true });
    expect(result.ok).toBe(false);
    expect(setGlobalAIControls).not.toHaveBeenCalled();
  });

  it("updates per-company controls when authorized", async () => {
    requirePermission.mockResolvedValue(undefined);
    setGlobalAIControls.mockResolvedValue(undefined);
    const result = await updateGlobalControls({ companyId, paused: true });
    expect(result.ok).toBe(true);
    expect(setGlobalAIControls).toHaveBeenCalledWith(companyId, "user-1", expect.objectContaining({ paused: true }));
  });
});
