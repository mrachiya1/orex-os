import { describe, it, expect } from "vitest";
import { updateProjectValueSchema, createClientSchema } from "./clients";

const projectId = "11111111-1111-4111-8111-111111111111";

describe("updateProjectValueSchema", () => {
  it("accepts both value and currency as null (not tracked)", () => {
    const result = updateProjectValueSchema.safeParse({ projectId, projectValueMinor: null, currencyCode: null });
    expect(result.success).toBe(true);
  });

  it("accepts a zero value with a valid currency", () => {
    const result = updateProjectValueSchema.safeParse({ projectId, projectValueMinor: 0, currencyCode: "USD" });
    expect(result.success).toBe(true);
  });

  it("accepts a positive value with a valid currency", () => {
    const result = updateProjectValueSchema.safeParse({ projectId, projectValueMinor: 350000, currencyCode: "USD" });
    expect(result.success).toBe(true);
  });

  it("rejects a negative value", () => {
    const result = updateProjectValueSchema.safeParse({ projectId, projectValueMinor: -100, currencyCode: "USD" });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported currency code", () => {
    const result = updateProjectValueSchema.safeParse({ projectId, projectValueMinor: 1000, currencyCode: "XXX" });
    expect(result.success).toBe(false);
  });

  it("rejects a value set without a currency", () => {
    const result = updateProjectValueSchema.safeParse({ projectId, projectValueMinor: 1000, currencyCode: null });
    expect(result.success).toBe(false);
  });

  it("rejects a currency set without a value", () => {
    const result = updateProjectValueSchema.safeParse({ projectId, projectValueMinor: null, currencyCode: "USD" });
    expect(result.success).toBe(false);
  });
});

describe("createClientSchema", () => {
  it("requires a company id and organisation id", () => {
    const result = createClientSchema.safeParse({ name: "Nova Labs" });
    expect(result.success).toBe(false);
  });

  it("defaults status to lead and relationshipStage to new", () => {
    const result = createClientSchema.safeParse({
      organisationId: projectId,
      companyId: projectId,
      name: "Nova Labs",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("lead");
      expect(result.data.relationshipStage).toBe("new");
    }
  });
});
