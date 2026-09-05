import { describe, it, expect } from "vitest";
import { validatePropertyValue, validatePropertyConfiguration } from "./project-properties";

describe("validatePropertyConfiguration", () => {
  it("requires at least one option for select/multi_select/status", () => {
    expect(() => validatePropertyConfiguration("select", { options: [] })).toThrow();
    expect(() => validatePropertyConfiguration("select", { options: [{ id: "a", label: "A" }] })).not.toThrow();
  });

  it("rejects unknown keys on a text property (strict schema)", () => {
    expect(() => validatePropertyConfiguration("text", { options: [{ id: "a", label: "A" }] })).toThrow();
  });
});

describe("validatePropertyValue", () => {
  it("accepts a valid select value from the configured options", () => {
    expect(validatePropertyValue("select", { options: [{ id: "a", label: "A" }] }, "a")).toBe("a");
  });

  it("rejects a select value not in the configured options", () => {
    expect(() => validatePropertyValue("select", { options: [{ id: "a", label: "A" }] }, "z")).toThrow();
  });

  it("rejects a multi_select value containing an unconfigured option", () => {
    expect(() =>
      validatePropertyValue("multi_select", { options: [{ id: "a", label: "A" }] }, ["a", "z"])
    ).toThrow();
  });

  it("accepts a checkbox boolean and coerces missing value to false", () => {
    expect(validatePropertyValue("checkbox", {}, true)).toBe(true);
    expect(validatePropertyValue("checkbox", {}, undefined)).toBe(false);
  });

  it("rejects a malformed date string", () => {
    expect(() => validatePropertyValue("date", {}, "not-a-date")).toThrow();
    expect(validatePropertyValue("date", {}, "2026-09-05")).toBe("2026-09-05");
  });

  it("rejects an unsafe URL (embedded credentials)", () => {
    expect(() => validatePropertyValue("url", {}, "https://user:pass@example.com")).toThrow();
    expect(validatePropertyValue("url", {}, "https://example.com")).toBe("https://example.com");
  });

  it("rejects a person value not in the authorized member set", () => {
    const allowed = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    const members = new Set([allowed]);
    expect(() => validatePropertyValue("person", {}, other, members)).toThrow();
    expect(validatePropertyValue("person", {}, allowed, members)).toBe(allowed);
  });

  it("rejects the not-yet-supported files type", () => {
    expect(() => validatePropertyValue("files", {}, {})).toThrow();
  });
});
