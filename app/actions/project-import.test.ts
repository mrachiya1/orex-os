import { describe, it, expect, vi, beforeEach } from "vitest";

const requireCurrentUser = vi.fn();
const requireScopedPermission = vi.fn();
const writeAuditLog = vi.fn();
const writeProjectActivity = vi.fn();
const ensureDefaultWorkspaceSections = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: (...a: unknown[]) => requireCurrentUser(...a),
}));
vi.mock("@/lib/permissions", () => ({
  requireScopedPermission: (...a: unknown[]) => requireScopedPermission(...a),
  PERMISSIONS: { PROJECTS_CREATE: "projects.create" },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/projects/activity", () => ({
  writeProjectActivity: (...a: unknown[]) => writeProjectActivity(...a),
}));
vi.mock("@/lib/projects/workspace", () => ({
  ensureDefaultWorkspaceSections: (...a: unknown[]) => ensureDefaultWorkspaceSections(...a),
}));

/**
 * A generic fake Supabase client: every `.insert(rows)` records the rows
 * under that table name and hands back generated ids; every plain
 * `.select().eq()...` read returns whatever was pre-configured via
 * `setResponse`. Good enough to exercise the actual insert-ordering and
 * rollback logic in app/actions/project-import.ts without a real database.
 */
function createFakeSupabase() {
  const insertedByTable: Record<string, unknown[]> = {};
  const responses: Record<string, { data: unknown; error: { message: string } | null }> = {};
  const insertErrorForTable: Record<string, string> = {};
  let idCounter = 0;
  const deletedProjectIds: string[] = [];

  function makeChain(table: string) {
    let mode: "select" | "insert" | "delete" = "select";
    let pendingRows: Record<string, unknown>[] = [];

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        if (mode === "delete" && table === "projects" && col === "id") deletedProjectIds.push(val as string);
        return chain;
      },
      insert: (rows: unknown) => {
        mode = "insert";
        pendingRows = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [rows as Record<string, unknown>];
        return chain;
      },
      delete: () => {
        mode = "delete";
        return chain;
      },
      single: async () => {
        if (insertErrorForTable[table]) return { data: null, error: { message: insertErrorForTable[table] } };
        const row = { ...pendingRows[0], id: `${table}-${idCounter++}` };
        insertedByTable[table] = (insertedByTable[table] ?? []).concat([row]);
        return { data: row, error: null };
      },
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
        if (mode === "insert") {
          if (insertErrorForTable[table]) {
            resolve({ data: null, error: { message: insertErrorForTable[table] } });
            return;
          }
          const rows = pendingRows.map((r) => ({ ...r, id: `${table}-${idCounter++}` }));
          insertedByTable[table] = (insertedByTable[table] ?? []).concat(rows);
          resolve({ data: rows, error: null });
        } else if (mode === "delete") {
          resolve({ data: null, error: null });
        } else {
          resolve(responses[table] ?? { data: [], error: null });
        }
      },
    };
    return chain;
  }

  return {
    client: { from: (table: string) => makeChain(table) },
    insertedByTable,
    deletedProjectIds,
    setResponse: (table: string, data: unknown) => {
      responses[table] = { data, error: null };
    },
    setInsertError: (table: string, message: string) => {
      insertErrorForTable[table] = message;
    },
  };
}

let fake: ReturnType<typeof createFakeSupabase>;
vi.mock("@/lib/database/server", () => ({
  createServerSupabaseClient: async () => fake.client,
}));

const { importProject } = await import("./project-import");

const companyId = "11111111-1111-4111-8111-111111111111";
const organisationId = "22222222-2222-4222-8222-222222222222";

function baseFile(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    exportedAt: "2026-09-06T00:00:00.000Z",
    project: {
      name: "Imported Project",
      projectCode: "IMP-001",
      projectType: "web_development",
      priority: "normal",
      internalNotesClassification: "internal",
      status: "active",
      healthState: "healthy",
      ownerEmail: "owner@example.com",
    },
    ...overrides,
  };
}

describe("importProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake = createFakeSupabase();
    fake.setResponse("company_members", [
      { user_id: "user-owner", user_profiles: { email: "owner@example.com" } },
    ]);
    requireCurrentUser.mockResolvedValue({ id: "importer-1" });
    requireScopedPermission.mockResolvedValue(undefined);
    ensureDefaultWorkspaceSections.mockResolvedValue(undefined);
  });

  it("rejects a malformed file before touching the database", async () => {
    const result = await importProject({ companyId, organisationId, file: { not: "valid" } });
    expect(result.ok).toBe(false);
    expect(requireCurrentUser).not.toHaveBeenCalled();
  });

  it("rejects when the caller lacks projects.create in the target company", async () => {
    requireScopedPermission.mockRejectedValue(new Error("Forbidden"));
    const result = await importProject({ companyId, organisationId, file: baseFile() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission/i);
  });

  it("remaps a matching owner email to the target company's member id", async () => {
    const result = await importProject({ companyId, organisationId, file: baseFile() });
    expect(result.ok).toBe(true);
    const project = fake.insertedByTable.projects?.[0] as Record<string, unknown>;
    expect(project.owner_id).toBe("user-owner");
  });

  it("leaves an unmatched email unassigned (null), never defaulted to the importer", async () => {
    const file = baseFile({
      project: { ...baseFile().project, ownerEmail: "nobody-here@example.com" },
    });
    const result = await importProject({ companyId, organisationId, file });
    expect(result.ok).toBe(true);
    const project = fake.insertedByTable.projects?.[0] as Record<string, unknown>;
    expect(project.owner_id).toBeNull();
  });

  it("inserts a milestone tree parent-first, remapping parent_milestone_id to the new id", async () => {
    const file = baseFile({
      milestones: [
        { localId: "child", parentLocalId: "root", title: "Child", status: "pending", sequence: 1, isBlocking: false },
        { localId: "root", parentLocalId: null, title: "Root", status: "pending", sequence: 0, isBlocking: false },
      ],
    });
    const result = await importProject({ companyId, organisationId, file });
    expect(result.ok).toBe(true);
    const milestones = fake.insertedByTable.project_milestones as Record<string, unknown>[];
    const root = milestones.find((m) => m.title === "Root")!;
    const child = milestones.find((m) => m.title === "Child")!;
    expect(root.parent_milestone_id).toBeNull();
    expect(child.parent_milestone_id).toBe(root.id);
  });

  it("rejects a milestone file with a cycle instead of looping forever", async () => {
    const file = baseFile({
      milestones: [
        { localId: "a", parentLocalId: "b", title: "A", status: "pending", sequence: 0, isBlocking: false },
        { localId: "b", parentLocalId: "a", title: "B", status: "pending", sequence: 0, isBlocking: false },
      ],
    });
    const result = await importProject({ companyId, organisationId, file });
    expect(result.ok).toBe(false);
  });

  it("rolls back (deletes the created project) if a later insert fails, leaving no partial project", async () => {
    fake.setInsertError("project_tasks", "db exploded");
    const file = baseFile({ tasks: [{ title: "Some task", status: "todo", priority: "normal" }] });
    const result = await importProject({ companyId, organisationId, file });
    expect(result.ok).toBe(false);
    const createdProjectId = (fake.insertedByTable.projects?.[0] as Record<string, unknown>).id;
    expect(fake.deletedProjectIds).toContain(createdProjectId);
  });

  it("only imports property values for definitions that already exist in the target company", async () => {
    fake.setResponse("project_property_definitions", [{ id: "def-1", name: "Renderer", property_type: "text" }]);
    const file = baseFile({
      propertyValues: [
        { propertyName: "Renderer", propertyType: "text", value: "Blender" },
        { propertyName: "Unknown Property", propertyType: "text", value: "x" },
      ],
    });
    const result = await importProject({ companyId, organisationId, file });
    expect(result.ok).toBe(true);
    const values = fake.insertedByTable.project_property_values as Record<string, unknown>[] | undefined;
    expect(values?.length ?? 0).toBe(1);
    expect(values?.[0].property_definition_id).toBe("def-1");
  });
});
