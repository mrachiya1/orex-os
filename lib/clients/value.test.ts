import { describe, it, expect } from "vitest";
import { computeClientValue, averageValueMinor } from "./value";

describe("computeClientValue", () => {
  it("excludes a null project value from every total instead of treating it as zero", () => {
    const result = computeClientValue([{ status: "active", projectValueMinor: null, currencyCode: null }]);
    expect(result.totalsByCurrency).toHaveLength(0);
    expect(result.projectCount).toBe(1);
  });

  it("includes a zero project value as a real tracked value", () => {
    const result = computeClientValue([{ status: "active", projectValueMinor: 0, currencyCode: "USD" }]);
    expect(result.totalsByCurrency).toEqual([
      { currencyCode: "USD", lifetimeMinor: 0, activeMinor: 0, completedMinor: 0, projectCountWithValue: 1 },
    ]);
  });

  it("sums a positive project value into lifetime/active totals", () => {
    const result = computeClientValue([{ status: "active", projectValueMinor: 350000, currencyCode: "USD" }]);
    expect(result.totalsByCurrency[0].lifetimeMinor).toBe(350000);
    expect(result.totalsByCurrency[0].activeMinor).toBe(350000);
    expect(result.totalsByCurrency[0].completedMinor).toBe(0);
  });

  it("aggregates multiple projects in the same currency", () => {
    const result = computeClientValue([
      { status: "active", projectValueMinor: 100000, currencyCode: "USD" },
      { status: "completed", projectValueMinor: 200000, currencyCode: "USD" },
    ]);
    expect(result.totalsByCurrency).toHaveLength(1);
    expect(result.totalsByCurrency[0].lifetimeMinor).toBe(300000);
    expect(result.totalsByCurrency[0].activeMinor).toBe(100000);
    expect(result.totalsByCurrency[0].completedMinor).toBe(200000);
    expect(averageValueMinor(result.totalsByCurrency[0])).toBe(150000);
  });

  it("never sums across different currencies -- keeps them as separate totals", () => {
    const result = computeClientValue([
      { status: "active", projectValueMinor: 840000, currencyCode: "USD" },
      { status: "active", projectValueMinor: 32000000, currencyCode: "LKR" },
    ]);
    expect(result.totalsByCurrency).toHaveLength(2);
    const usd = result.totalsByCurrency.find((t) => t.currencyCode === "USD");
    const lkr = result.totalsByCurrency.find((t) => t.currencyCode === "LKR");
    expect(usd?.lifetimeMinor).toBe(840000);
    expect(lkr?.lifetimeMinor).toBe(32000000);
    // No combined/converted total field exists on the summary at all --
    // structurally impossible to accidentally sum across currencies.
    expect(result).not.toHaveProperty("totalMinor");
  });

  it("counts active vs completed project counts correctly regardless of value data", () => {
    const result = computeClientValue([
      { status: "active", projectValueMinor: null, currencyCode: null },
      { status: "delivered", projectValueMinor: null, currencyCode: null },
      { status: "cancelled", projectValueMinor: null, currencyCode: null },
    ]);
    expect(result.activeProjectCount).toBe(1);
    expect(result.completedProjectCount).toBe(1);
    expect(result.projectCount).toBe(3);
  });
});
