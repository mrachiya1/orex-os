import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn();
let countResponse: { count: number | null; error: null };

function mockChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: typeof countResponse) => void) => resolve(countResponse);
  return chain;
}

vi.mock("@/lib/database/server", () => ({
  createServerSupabaseClient: async () => ({
    from: (table: string) => {
      if (table === "project_sections" && insert.mock.calls.length === 0) {
        return { ...mockChain(), insert: (...args: unknown[]) => insert(...args) };
      }
      return { ...mockChain(), insert: (...args: unknown[]) => insert(...args) };
    },
  }),
}));

const { ensureDefaultWorkspaceSections, DEFAULT_CUSTOM_SECTIONS, DEFAULT_SYSTEM_SECTIONS } = await import(
  "./workspace"
);

describe("ensureDefaultWorkspaceSections", () => {
  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
  });

  it("seeds the default custom + system sections when the project has none yet", async () => {
    countResponse = { count: 0, error: null };
    await ensureDefaultWorkspaceSections({
      projectId: "project-1",
      organisationId: "org-1",
      companyId: "company-1",
      userId: "user-1",
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0] as Array<{ section_type: string; system_key: string | null }>;
    expect(rows).toHaveLength(DEFAULT_CUSTOM_SECTIONS.length + DEFAULT_SYSTEM_SECTIONS.length);
    expect(rows.filter((r) => r.section_type === "custom")).toHaveLength(DEFAULT_CUSTOM_SECTIONS.length);
    expect(rows.filter((r) => r.section_type === "system")).toHaveLength(DEFAULT_SYSTEM_SECTIONS.length);
    expect(rows.every((r) => (r.section_type === "system") === (r.system_key !== null))).toBe(true);
  });

  it("does nothing when the project already has sections (idempotent)", async () => {
    countResponse = { count: 3, error: null };
    await ensureDefaultWorkspaceSections({
      projectId: "project-1",
      organisationId: "org-1",
      companyId: "company-1",
      userId: "user-1",
    });

    expect(insert).not.toHaveBeenCalled();
  });
});
