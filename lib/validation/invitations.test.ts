import { describe, it, expect } from "vitest";
import { createInvitationSchema, acceptInvitationSchema } from "./invitations";

describe("createInvitationSchema", () => {
  const valid = {
    companyId: "11111111-1111-4111-8111-111111111111",
    roleId: "22222222-2222-4222-8222-222222222222",
    email: "person@example.com",
  };

  it("accepts a valid invitation payload", () => {
    expect(createInvitationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = createInvitationSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid companyId", () => {
    const result = createInvitationSchema.safeParse({ ...valid, companyId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing role", () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.roleId;
    const result = createInvitationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("acceptInvitationSchema", () => {
  it("accepts a plausible token", () => {
    expect(acceptInvitationSchema.safeParse({ token: "a".repeat(43) }).success).toBe(true);
  });

  it("rejects a too-short token", () => {
    expect(acceptInvitationSchema.safeParse({ token: "short" }).success).toBe(false);
  });
});
