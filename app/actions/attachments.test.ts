import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const hasPermission = vi.fn();
const hasOrgPermission = vi.fn();
const hasProjectAccess = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: (...a: unknown[]) => hasPermission(...a),
  hasOrgPermission: (...a: unknown[]) => hasOrgPermission(...a),
  hasProjectAccess: (...a: unknown[]) => hasProjectAccess(...a),
  PERMISSIONS: { PROJECTS_READ: "projects.read", KNOWLEDGE_READ: "knowledge.read", DECISIONS_READ: "decisions.read" },
}));
vi.mock("./sessions", () => ({ getSession: (...a: unknown[]) => getSession(...a) }));

function mockChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "insert", "order"]) {
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

const { attachReference } = await import("./attachments");

const sessionId = "11111111-1111-4111-8111-111111111111";
const referenceId = "22222222-2222-4222-8222-222222222222";

describe("attachReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    getSession.mockResolvedValue({ id: sessionId, organisation_id: "org-1", company_id: "company-1" });
  });

  it("attaches a project reference the caller can read", async () => {
    hasProjectAccess.mockResolvedValue(true);
    fromResponses = { agent_attachments: { data: { id: "att-1" }, error: null } };
    const result = await attachReference({ sessionId, attachmentType: "project_ref", referenceId });
    expect(result.ok).toBe(true);
  });

  it("denies a project reference the caller cannot read", async () => {
    hasProjectAccess.mockResolvedValue(false);
    const result = await attachReference({ sessionId, attachmentType: "project_ref", referenceId });
    expect(result.ok).toBe(false);
  });

  it("secret-classified knowledge content is never attachable, even with knowledge.read", async () => {
    hasPermission.mockResolvedValue(true);
    fromResponses = {
      knowledge_items: { data: { organisation_id: "org-1", company_id: "company-1", classification: "secret" }, error: null },
    };
    const result = await attachReference({ sessionId, attachmentType: "knowledge_ref", referenceId });
    expect(result.ok).toBe(false);
  });

  it("attaches non-secret knowledge content when the caller has knowledge.read", async () => {
    hasPermission.mockResolvedValue(true);
    fromResponses = {
      knowledge_items: { data: { organisation_id: "org-1", company_id: "company-1", classification: "internal" }, error: null },
      agent_attachments: { data: { id: "att-2" }, error: null },
    };
    const result = await attachReference({ sessionId, attachmentType: "knowledge_ref", referenceId });
    expect(result.ok).toBe(true);
  });

  it("denies knowledge content when the caller lacks knowledge.read, regardless of classification", async () => {
    hasPermission.mockResolvedValue(false);
    fromResponses = {
      knowledge_items: { data: { organisation_id: "org-1", company_id: "company-1", classification: "public" }, error: null },
    };
    const result = await attachReference({ sessionId, attachmentType: "knowledge_ref", referenceId });
    expect(result.ok).toBe(false);
  });

  it("returns an error when the session does not exist or is not accessible", async () => {
    getSession.mockResolvedValue(null);
    const result = await attachReference({ sessionId, attachmentType: "project_ref", referenceId });
    expect(result.ok).toBe(false);
  });
});
