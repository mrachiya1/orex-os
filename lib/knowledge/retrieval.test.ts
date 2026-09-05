import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const hasPermission = vi.fn();
const hasOrgPermission = vi.fn();
const embedText = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...args: unknown[]) => requireCurrentUser(...args),
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: (...args: unknown[]) => hasPermission(...args),
  hasOrgPermission: (...args: unknown[]) => hasOrgPermission(...args),
  PERMISSIONS: { KNOWLEDGE_READ: "knowledge.read" },
}));
vi.mock("@/lib/ai/embeddings", () => ({
  embedText: (...args: unknown[]) => embedText(...args),
}));
vi.mock("@/lib/database/server", () => ({
  createServerSupabaseClient: async () => ({ rpc: (...args: unknown[]) => rpc(...args) }),
}));

const { retrieveKnowledge } = await import("./retrieval");

describe("retrieveKnowledge", () => {
  beforeEach(() => {
    requireCurrentUser.mockResolvedValue({ id: "user-1" });
    hasPermission.mockReset();
    hasOrgPermission.mockReset();
    embedText.mockReset();
    rpc.mockReset();
  });

  it("returns no results and never queries the database when the caller lacks knowledge.read at company scope", async () => {
    hasPermission.mockResolvedValue(false);
    const result = await retrieveKnowledge({
      companyId: "company-a",
      organisationId: "org-1",
      query: "pricing strategy",
    });
    expect(result).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
    expect(embedText).not.toHaveBeenCalled();
  });

  it("returns no results and never queries the database when the caller lacks org-level knowledge.read for a group-level search", async () => {
    hasOrgPermission.mockResolvedValue(false);
    const result = await retrieveKnowledge({
      companyId: null,
      organisationId: "org-1",
      query: "group strategy",
    });
    expect(result).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("embeds the query and calls the RLS-enforced retrieval function when authorized", async () => {
    hasPermission.mockResolvedValue(true);
    embedText.mockResolvedValue({ embedding: [0.1, 0.2], model: "openai/text-embedding-3-small", dimension: 2 });
    rpc.mockResolvedValue({
      data: [
        {
          knowledge_item_id: "item-1",
          chunk_content: "Our mission is X.",
          similarity: 0.92,
          title: "Mission",
          domain: "identity",
          item_type: "mission",
          company_id: "company-a",
          source_label: "Manual entry",
          verification_status: "verified",
          lifecycle_status: "current",
          classification: "internal",
          confidence: null,
        },
      ],
      error: null,
    });

    const result = await retrieveKnowledge({
      companyId: "company-a",
      organisationId: "org-1",
      query: "what is our mission",
    });

    expect(result).toHaveLength(1);
    expect(result[0].knowledgeItemId).toBe("item-1");
    expect(result[0].verificationStatus).toBe("verified");
    const rpcArgs = rpc.mock.calls[0][1];
    expect(rpcArgs.filter_company_id).toBe("company-a");
    expect(rpcArgs.filter_organisation_id).toBeNull();
  });

  it("propagates a database error rather than silently returning an empty result", async () => {
    hasPermission.mockResolvedValue(true);
    embedText.mockResolvedValue({ embedding: [0.1], model: "m", dimension: 1 });
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(
      retrieveKnowledge({ companyId: "company-a", organisationId: "org-1", query: "x" })
    ).rejects.toThrow("boom");
  });
});
