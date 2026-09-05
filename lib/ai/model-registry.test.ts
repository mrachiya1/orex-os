import { describe, it, expect } from "vitest";
import { MODEL_REGISTRY, isKnownTaskAlias, getModelRoute } from "./model-registry";

describe("model-registry", () => {
  it("declares a primary model and a fallback array for every alias", () => {
    for (const [alias, route] of Object.entries(MODEL_REGISTRY)) {
      expect(route.primaryModel, `${alias} missing primaryModel`).toBeTruthy();
      expect(Array.isArray(route.fallbackModels), `${alias} fallbackModels not an array`).toBe(true);
    }
  });

  it("recognizes every registered alias", () => {
    for (const alias of Object.keys(MODEL_REGISTRY)) {
      expect(isKnownTaskAlias(alias)).toBe(true);
    }
  });

  it("rejects an unregistered alias", () => {
    expect(isKnownTaskAlias("not.a.real.alias")).toBe(false);
  });

  it("getModelRoute returns the exact registry entry for a known alias", () => {
    expect(getModelRoute("ops.fast")).toBe(MODEL_REGISTRY["ops.fast"]);
  });

  it("never fallback-chains an alias to itself", () => {
    for (const [alias, route] of Object.entries(MODEL_REGISTRY)) {
      expect(route.fallbackModels, alias).not.toContain(route.primaryModel);
    }
  });
});
