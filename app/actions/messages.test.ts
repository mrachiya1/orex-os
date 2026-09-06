import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const getSession = vi.fn();
const canMutateSession = vi.fn();
const runCompanyBrainCommand = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("./sessions", () => ({
  getSession: (...a: unknown[]) => getSession(...a),
  canMutateSession: (...a: unknown[]) => canMutateSession(...a),
}));
vi.mock("./agent-actions", () => ({
  runCompanyBrainCommand: (...a: unknown[]) => runCompanyBrainCommand(...a),
}));

const inserted: Array<Record<string, unknown>> = [];
function mockChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order"]) {
    chain[m] = () => chain;
  }
  chain.insert = (rows: Record<string, unknown>) => {
    inserted.push(rows);
    return chain;
  };
  chain.update = () => chain;
  chain.then = (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: [], error: null });
  return chain;
}
vi.mock("@/lib/database/server", () => ({
  createServerSupabaseClient: async () => ({ from: () => mockChain() }),
  createServiceRoleClient: () => ({ from: () => mockChain() }),
}));

const { sendMessage } = await import("./messages");

const sessionId = "11111111-1111-4111-8111-111111111111";

describe("sendMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inserted.length = 0;
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    getSession.mockResolvedValue({ id: sessionId, organisation_id: "org-1", company_id: "company-1", created_by: "user-1" });
    canMutateSession.mockResolvedValue(true);
  });

  it("returns an error when the session does not exist", async () => {
    getSession.mockResolvedValue(null);
    const result = await sendMessage({ sessionId, content: "Hi" });
    expect(result.ok).toBe(false);
  });

  it("SECURITY: refuses to post into a session the caller cannot mutate (agents.read visibility is not write authorization)", async () => {
    canMutateSession.mockResolvedValue(false);
    const result = await sendMessage({ sessionId, content: "Hi" });
    expect(result.ok).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it("persists the user message before invoking the agent, and the assistant's reply after", async () => {
    runCompanyBrainCommand.mockResolvedValue({ ok: true, kind: "answer", answer: "We do X.", citedSources: [] });

    const result = await sendMessage({ sessionId, content: "What do we do?" });

    expect(result.ok).toBe(true);
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({ role: "user", content: "What do we do?" });
    expect(inserted[1]).toMatchObject({ role: "assistant", content: "We do X." });
  });

  it("still persists a (failure) assistant message and returns ok:false when the agent call fails", async () => {
    runCompanyBrainCommand.mockResolvedValue({ ok: false, error: "Something went wrong." });

    const result = await sendMessage({ sessionId, content: "What do we do?" });

    expect(result.ok).toBe(false);
    expect(inserted).toHaveLength(2);
    expect(inserted[1]).toMatchObject({ role: "assistant", content: "Something went wrong." });
  });

  it("never throws when the underlying agent call itself throws", async () => {
    runCompanyBrainCommand.mockRejectedValue(new Error("boom"));
    const result = await sendMessage({ sessionId, content: "hi" });
    expect(result.ok).toBe(false);
  });
});
