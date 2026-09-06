import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const hasPermission = vi.fn();
const hasOrgPermission = vi.fn();
const requireScopedPermission = vi.fn();
const retrieveKnowledge = vi.fn();
const requestAI = vi.fn();
const embedText = vi.fn();
const chunkKnowledgeContent = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: (...a: unknown[]) => hasPermission(...a),
  hasOrgPermission: (...a: unknown[]) => hasOrgPermission(...a),
  requireScopedPermission: (...a: unknown[]) => requireScopedPermission(...a),
  PERMISSIONS: {
    KNOWLEDGE_READ: "knowledge.read",
    KNOWLEDGE_CREATE: "knowledge.create",
    KNOWLEDGE_VERIFY: "knowledge.verify",
    KNOWLEDGE_MANAGE: "knowledge.manage",
    AI_USE: "ai.use",
  },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/database/server", () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/knowledge/chunking", () => ({
  chunkKnowledgeContent: (...a: unknown[]) => chunkKnowledgeContent(...a),
}));
vi.mock("@/lib/knowledge/retrieval", () => ({
  retrieveKnowledge: (...a: unknown[]) => retrieveKnowledge(...a),
}));
vi.mock("@/lib/ai/embeddings", () => ({ embedText: (...a: unknown[]) => embedText(...a) }));
vi.mock("@/lib/ai/gateway", () => ({ requestAI: (...a: unknown[]) => requestAI(...a) }));

const { askCompanyBrain } = await import("./knowledge");

const organisationId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

describe("askCompanyBrain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("returns a safe controlled response when there is zero knowledge, without calling the AI provider", async () => {
    hasPermission.mockResolvedValue(true);
    retrieveKnowledge.mockResolvedValue([]);

    const result = await askCompanyBrain({ organisationId, companyId, question: "Hi" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer).toMatch(/don't have enough verified/i);
      expect(result.citedSources).toEqual([]);
    }
    expect(requestAI).not.toHaveBeenCalled();
  });

  it("returns ok:false, never throws, when the caller lacks knowledge.read", async () => {
    hasPermission.mockResolvedValueOnce(false); // knowledge.read check

    const result = await askCompanyBrain({ organisationId, companyId, question: "Hi" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
  });

  it("returns ok:false, never throws, when the caller lacks ai.use", async () => {
    hasPermission.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // knowledge.read, then ai.use

    const result = await askCompanyBrain({ organisationId, companyId, question: "Hi" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
  });

  it("never throws when the permission RPC itself errors", async () => {
    hasPermission.mockRejectedValue(new Error("Permission check failed: connection reset"));

    const result = await askCompanyBrain({ organisationId, companyId, question: "Hi" });

    expect(result.ok).toBe(false);
  });

  it("never throws when embedding/retrieval fails (e.g. a missing OPENROUTER_API_KEY) even with zero knowledge items", async () => {
    hasPermission.mockResolvedValue(true);
    retrieveKnowledge.mockRejectedValue(new Error("OPENROUTER_API_KEY is not configured"));

    const result = await askCompanyBrain({ organisationId, companyId, question: "Hi" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain("OPENROUTER_API_KEY");
  });

  it("never throws when the AI provider call itself fails", async () => {
    hasPermission.mockResolvedValue(true);
    retrieveKnowledge.mockResolvedValue([
      { knowledgeItemId: "k1", title: "Fact", content: "...", classification: "internal", verificationStatus: "verified" },
    ]);
    requestAI.mockRejectedValue(new Error("provider timed out"));

    const result = await askCompanyBrain({ organisationId, companyId, question: "What do we do?" });

    expect(result.ok).toBe(false);
  });

  it("returns the structured answer on success", async () => {
    hasPermission.mockResolvedValue(true);
    retrieveKnowledge.mockResolvedValue([
      { knowledgeItemId: "k1", title: "Fact", content: "...", classification: "internal", verificationStatus: "verified" },
    ]);
    requestAI.mockResolvedValue({ data: { answer: "We do X.", citedSources: [{ knowledgeItemId: "k1", title: "Fact" }] } });

    const result = await askCompanyBrain({ organisationId, companyId, question: "What do we do?" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer).toBe("We do X.");
      expect(result.citedSources).toEqual([{ knowledgeItemId: "k1", title: "Fact" }]);
    }
  });

  it("returns ok:false for malformed input instead of throwing an unhandled error", async () => {
    const result = await askCompanyBrain({ organisationId: "not-a-uuid" });
    expect(result.ok).toBe(false);
  });
});
