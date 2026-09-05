import { describe, it, expect } from "vitest";
import { redactContext, highestClassification, type ClassifiedField } from "./redaction";

describe("redactContext", () => {
  it("always strips a Secret-classified field regardless of allowlist", () => {
    const fields: ClassifiedField[] = [{ key: "apiKey", value: "sk-123", classification: "secret" }];
    const result = redactContext(fields, { allowConfidential: true, allowRestricted: true });
    expect(result).not.toHaveProperty("apiKey");
  });

  it("strips secret-shaped values even inside an allowed field (defense in depth)", () => {
    const fields: ClassifiedField[] = [
      { key: "profile", value: { name: "Ada", password: "hunter2" }, classification: "internal" },
    ];
    const result = redactContext(fields, { allowConfidential: false, allowRestricted: false });
    expect(result.profile).toEqual({ name: "Ada", password: "[redacted]" });
  });

  it("excludes Restricted fields by default", () => {
    const fields: ClassifiedField[] = [{ key: "revenue", value: 100, classification: "restricted" }];
    const result = redactContext(fields, { allowConfidential: false, allowRestricted: false });
    expect(result).not.toHaveProperty("revenue");
  });

  it("includes Restricted fields when the task allowlists them", () => {
    const fields: ClassifiedField[] = [{ key: "revenue", value: 100, classification: "restricted" }];
    const result = redactContext(fields, { allowConfidential: false, allowRestricted: true });
    expect(result.revenue).toBe(100);
  });

  it("excludes Confidential fields by default", () => {
    const fields: ClassifiedField[] = [
      { key: "disappointmentLog", value: "note", classification: "confidential" },
    ];
    const result = redactContext(fields, { allowConfidential: false, allowRestricted: false });
    expect(result).not.toHaveProperty("disappointmentLog");
  });

  it("includes Public and Internal fields unconditionally", () => {
    const fields: ClassifiedField[] = [
      { key: "companyName", value: "Orextic", classification: "public" },
      { key: "projectName", value: "Website", classification: "internal" },
    ];
    const result = redactContext(fields, { allowConfidential: false, allowRestricted: false });
    expect(result).toEqual({ companyName: "Orextic", projectName: "Website" });
  });
});

describe("highestClassification", () => {
  it("returns public for an empty or all-public set", () => {
    expect(highestClassification([])).toBe("public");
    expect(highestClassification([{ classification: "public" }])).toBe("public");
  });

  it("returns the highest classification present", () => {
    expect(
      highestClassification([
        { classification: "public" },
        { classification: "restricted" },
        { classification: "internal" },
      ])
    ).toBe("restricted");
  });
});
