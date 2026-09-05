import { describe, it, expect } from "vitest";
import { buildProviderPreferences } from "./privacy";
import { AIGatewayError } from "./errors";

describe("buildProviderPreferences", () => {
  it("applies no constraint for Public data", () => {
    expect(buildProviderPreferences("public")).toBeUndefined();
  });

  it("applies no constraint for Internal data", () => {
    expect(buildProviderPreferences("internal")).toBeUndefined();
  });

  it("denies data-collection providers for Confidential data", () => {
    const prefs = buildProviderPreferences("confidential");
    expect(prefs).toMatchObject({ dataCollection: "deny" });
  });

  it("requires ZDR routing for Restricted data", () => {
    const prefs = buildProviderPreferences("restricted");
    expect(prefs).toMatchObject({ dataCollection: "deny", zdr: true, requireParameters: true });
  });

  it("refuses to build any routing for Secret data (must never reach a provider)", () => {
    expect(() => buildProviderPreferences("secret")).toThrow(AIGatewayError);
    try {
      buildProviderPreferences("secret");
    } catch (err) {
      expect((err as AIGatewayError).code).toBe("PRIVACY_POLICY_REJECTED");
    }
  });
});
