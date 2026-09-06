import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const requirePermission = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  requirePermission: (...a: unknown[]) => requirePermission(...a),
  hasPermission: vi.fn(),
  PERMISSIONS: {
    TEAM_READ: "team.read",
    TEAM_INVITE: "team.invite",
    TEAM_REMOVE: "team.remove",
    TEAM_UPDATE: "team.update",
    PERMISSIONS_MANAGE: "permissions.manage",
  },
}));
vi.mock("@/lib/permissions/role-cap", () => ({
  isRoleAssignable: vi.fn(),
  areOverridesAssignable: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/invitation-token", () => ({
  generateInvitationToken: vi.fn(),
  hashInvitationToken: vi.fn(),
}));
vi.mock("@/lib/integrations/email", () => ({ sendInvitationEmail: vi.fn() }));
vi.mock("@/lib/config/app-url", () => ({ buildAppUrl: vi.fn() }));

// A minimal, per-test-configurable chainable query builder mock.
function mockChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: typeof result) => void) => resolve(result);
  return chain;
}

let fromResponses: Record<string, { data: unknown; error: { message: string } | null }> = {};
vi.mock("@/lib/database/server", () => ({
  createServerSupabaseClient: async () => ({
    from: (table: string) => mockChain(fromResponses[table] ?? { data: null, error: null }),
  }),
  createServiceRoleClient: vi.fn(),
}));

const { listInvitations } = await import("./team");

const companyId = "11111111-1111-4111-8111-111111111111";

describe("listInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromResponses = {};
  });

  it("requires team.read on the given company before querying", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    requirePermission.mockResolvedValue(undefined);
    fromResponses.invitations = { data: [], error: null };

    await listInvitations(companyId);

    expect(requirePermission).toHaveBeenCalledWith(companyId, "team.read");
  });

  it("rejects when the caller lacks team.read", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    requirePermission.mockRejectedValue(new Error("Forbidden"));

    await expect(listInvitations(companyId)).rejects.toThrow("Forbidden");
  });

  it("returns every invitation regardless of status, newest first as ordered by the query", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    requirePermission.mockResolvedValue(undefined);
    const rows = [
      { id: "inv-2", email: "b@example.com", status: "pending", expires_at: "2026-09-10", created_at: "2026-09-06", invited_by: "user-1", roles: { label: "Member" } },
      { id: "inv-1", email: "a@example.com", status: "revoked", expires_at: "2026-09-01", created_at: "2026-08-30", invited_by: "user-1", roles: { label: "Director" } },
    ];
    fromResponses.invitations = { data: rows, error: null };

    const result = await listInvitations(companyId);

    expect(result).toEqual(rows);
  });

  it("throws on a database error", async () => {
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    requirePermission.mockResolvedValue(undefined);
    fromResponses.invitations = { data: null, error: { message: "db down" } };

    await expect(listInvitations(companyId)).rejects.toThrow("db down");
  });
});
