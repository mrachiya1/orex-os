import { describe, it, expect } from "vitest";
import { redactSecrets, SECRET_KEY_PATTERN } from "./redaction";

describe("redactSecrets (extracted from lib/audit, shared with lib/ai)", () => {
  it("redacts a top-level secret-shaped field", () => {
    expect(redactSecrets({ password: "hunter2", name: "ok" })).toEqual({
      password: "[redacted]",
      name: "ok",
    });
  });

  it("redacts nested secret-shaped fields", () => {
    expect(redactSecrets({ user: { api_key: "sk-123", email: "a@b.com" } })).toEqual({
      user: { api_key: "[redacted]", email: "a@b.com" },
    });
  });

  it("redacts secret-shaped fields inside arrays", () => {
    expect(redactSecrets([{ token: "abc" }, { name: "ok" }])).toEqual([
      { token: "[redacted]" },
      { name: "ok" },
    ]);
  });

  it("passes through null and primitives unchanged", () => {
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets("plain string")).toBe("plain string");
    expect(redactSecrets(42)).toBe(42);
  });

  it("matches the documented secret-key pattern", () => {
    for (const key of ["token", "password", "secret", "api_key", "apiKey", "access_key"]) {
      expect(SECRET_KEY_PATTERN.test(key)).toBe(true);
    }
    expect(SECRET_KEY_PATTERN.test("company_name")).toBe(false);
  });
});
