import { describe, it, expect } from "vitest";
import { projectExportSchema } from "./project-export";

function validPayload() {
  return {
    schemaVersion: 1 as const,
    exportedAt: "2026-09-06T00:00:00.000Z",
    project: {
      name: "Test Project",
      projectCode: "TP-001",
      projectType: "web_development",
      priority: "normal" as const,
      internalNotesClassification: "internal" as const,
      status: "active" as const,
      healthState: "healthy" as const,
    },
  };
}

describe("projectExportSchema", () => {
  it("accepts a minimal well-formed payload, defaulting every child array to empty", () => {
    const result = projectExportSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.milestones).toEqual([]);
      expect(result.data.members).toEqual([]);
    }
  });

  it("accepts a payload with a full milestone tree, tasks, and property values", () => {
    const payload = {
      ...validPayload(),
      milestones: [
        { localId: "m1", parentLocalId: null, title: "Phase 1", status: "pending", sequence: 0, isBlocking: false },
        { localId: "m2", parentLocalId: "m1", title: "Phase 1a", status: "pending", sequence: 0, isBlocking: false },
      ],
      tasks: [{ milestoneLocalId: "m2", title: "Do the thing", status: "todo", priority: "normal" }],
      propertyValues: [{ propertyName: "Renderer", propertyType: "text", value: "Blender" }],
    };
    expect(projectExportSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects a wrong schemaVersion", () => {
    const result = projectExportSchema.safeParse({ ...validPayload(), schemaVersion: 2 });
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing required project fields", () => {
    const payload = validPayload();
    // @ts-expect-error deliberately malformed for the test
    delete payload.project.name;
    expect(projectExportSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an invalid status enum value", () => {
    const payload = validPayload();
    payload.project.status = "not_a_real_status" as never;
    expect(projectExportSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an oversized milestones array", () => {
    const milestones = Array.from({ length: 501 }, (_, i) => ({
      localId: `m${i}`,
      title: `Milestone ${i}`,
      status: "pending" as const,
      sequence: i,
      isBlocking: false,
    }));
    const result = projectExportSchema.safeParse({ ...validPayload(), milestones });
    expect(result.success).toBe(false);
  });

  it("rejects a non-email string in an email reference field", () => {
    const payload = { ...validPayload(), project: { ...validPayload().project, ownerEmail: "not-an-email" } };
    expect(projectExportSchema.safeParse(payload).success).toBe(false);
  });
});
