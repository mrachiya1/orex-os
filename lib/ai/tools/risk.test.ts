import { describe, it, expect } from "vitest";
import { requiresApprovalByDefault, isExecutionAllowed } from "./risk";

describe("requiresApprovalByDefault", () => {
  it("does not require approval for risk 0-1", () => {
    expect(requiresApprovalByDefault(0)).toBe(false);
    expect(requiresApprovalByDefault(1)).toBe(false);
  });

  it("requires approval for risk 2-3", () => {
    expect(requiresApprovalByDefault(2)).toBe(true);
    expect(requiresApprovalByDefault(3)).toBe(true);
  });
});

describe("isExecutionAllowed", () => {
  it("READ_ONLY: only risk 0 executes, everything else is refused outright (never proposed)", () => {
    expect(isExecutionAllowed("READ_ONLY", 0)).toBe("execute");
    expect(isExecutionAllowed("READ_ONLY", 1)).toBe("refuse");
    expect(isExecutionAllowed("READ_ONLY", 2)).toBe("refuse");
    expect(isExecutionAllowed("READ_ONLY", 3)).toBe("refuse");
  });

  it("SUGGEST_ONLY: risk 0 executes, everything above is always proposed", () => {
    expect(isExecutionAllowed("SUGGEST_ONLY", 0)).toBe("execute");
    expect(isExecutionAllowed("SUGGEST_ONLY", 1)).toBe("propose");
    expect(isExecutionAllowed("SUGGEST_ONLY", 3)).toBe("propose");
  });

  it("CONFIRM_TO_ACT: risk 0 executes, anything above always requires confirmation, even a safe update", () => {
    expect(isExecutionAllowed("CONFIRM_TO_ACT", 0)).toBe("execute");
    expect(isExecutionAllowed("CONFIRM_TO_ACT", 1)).toBe("propose");
    expect(isExecutionAllowed("CONFIRM_TO_ACT", 2)).toBe("propose");
  });

  it("AUTO_SAFE: risk 0-1 execute immediately, risk 2+ still requires confirmation", () => {
    expect(isExecutionAllowed("AUTO_SAFE", 0)).toBe("execute");
    expect(isExecutionAllowed("AUTO_SAFE", 1)).toBe("execute");
    expect(isExecutionAllowed("AUTO_SAFE", 2)).toBe("propose");
    expect(isExecutionAllowed("AUTO_SAFE", 3)).toBe("propose");
  });
});
