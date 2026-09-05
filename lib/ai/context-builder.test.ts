import { describe, it, expect } from "vitest";
import { buildContext } from "./context-builder";
import { AIGatewayError } from "./errors";

describe("buildContext", () => {
  it("fails closed if a Secret-classified field was ever assembled", () => {
    expect(() =>
      buildContext({
        fields: [{ key: "apiKey", value: "sk-123", classification: "secret" }],
        allowConfidential: true,
        allowRestricted: true,
      })
    ).toThrow(AIGatewayError);
  });

  it("returns public classification for an empty context", () => {
    const built = buildContext({ fields: [], allowConfidential: false, allowRestricted: false });
    expect(built.classification).toBe("public");
    expect(built.redacted).toEqual({});
  });

  it("reflects the highest surviving (post-redaction) classification, not the highest requested", () => {
    // Restricted field is present but NOT allowlisted, so it's dropped --
    // the surviving classification should be Internal, not Restricted.
    const built = buildContext({
      fields: [
        { key: "projectName", value: "Website", classification: "internal" },
        { key: "revenue", value: 100, classification: "restricted" },
      ],
      allowConfidential: false,
      allowRestricted: false,
    });
    expect(built.classification).toBe("internal");
    expect(built.redacted).not.toHaveProperty("revenue");
  });

  it("reflects Restricted classification when the task allowlists it", () => {
    const built = buildContext({
      fields: [{ key: "revenue", value: 100, classification: "restricted" }],
      allowConfidential: false,
      allowRestricted: true,
    });
    expect(built.classification).toBe("restricted");
  });
});
