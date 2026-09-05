import { describe, it, expect } from "vitest";
import { generateInvitationToken, hashInvitationToken } from "./invitation-token";

describe("invitation tokens", () => {
  it("generates a high-entropy token distinct from its hash", () => {
    const { token, tokenHash } = generateInvitationToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique tokens on each call", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("hashing the same token twice produces the same hash", () => {
    const { token, tokenHash } = generateInvitationToken();
    expect(hashInvitationToken(token)).toBe(tokenHash);
  });

  it("hashing different tokens produces different hashes", () => {
    expect(hashInvitationToken("token-a")).not.toBe(hashInvitationToken("token-b"));
  });
});
