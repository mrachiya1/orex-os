import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn();

vi.mock("@/lib/database/server", () => ({
  createServiceRoleClient: () => ({
    from: () => ({ insert: (...args: unknown[]) => insert(...args) }),
  }),
}));

const { writeProjectActivity } = await import("./activity");

describe("writeProjectActivity", () => {
  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
  });

  it("writes the event with all fields mapped to snake_case columns", async () => {
    await writeProjectActivity({
      projectId: "project-1",
      actorUserId: "user-1",
      eventType: "status_changed",
      summary: "Status changed from active to review",
      metadata: { from: "active", to: "review" },
    });

    expect(insert).toHaveBeenCalledWith({
      project_id: "project-1",
      actor_user_id: "user-1",
      event_type: "status_changed",
      summary: "Status changed from active to review",
      metadata: { from: "active", to: "review" },
    });
  });

  it("defaults metadata to null when omitted", async () => {
    await writeProjectActivity({
      projectId: "project-1",
      actorUserId: "user-1",
      eventType: "project.created",
      summary: "Project created",
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ metadata: null }));
  });

  it("never throws when the insert fails -- logs instead", async () => {
    insert.mockResolvedValue({ error: { message: "db down" } });
    await expect(
      writeProjectActivity({
        projectId: "project-1",
        actorUserId: "user-1",
        eventType: "project.created",
        summary: "Project created",
      })
    ).resolves.toBeUndefined();
  });
});
