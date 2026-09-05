import { describe, it, expect } from "vitest";
import { isRoleAssignable, areOverridesAssignable } from "./role-cap";

describe("isRoleAssignable", () => {
  it("allows assigning a role that is a subset of the inviter's permissions", () => {
    const inviter = ["companies.read", "team.read", "team.invite", "projects.read"];
    const viewer = ["companies.read", "team.read", "projects.read"];
    expect(isRoleAssignable(inviter, viewer)).toBe(true);
  });

  it("rejects assigning a role with a permission the inviter lacks (privilege escalation)", () => {
    const director = ["companies.read", "team.read", "team.invite", "finance.read"];
    const founderOnly = ["companies.read", "permissions.manage"];
    expect(isRoleAssignable(director, founderOnly)).toBe(false);
  });

  it("allows assigning the exact same permission set", () => {
    const perms = ["companies.read", "team.read"];
    expect(isRoleAssignable(perms, perms)).toBe(true);
  });

  it("allows assigning an empty (no-permission) role", () => {
    expect(isRoleAssignable(["companies.read"], [])).toBe(true);
  });

  it("rejects when the inviter has no permissions at all but the target role has any", () => {
    expect(isRoleAssignable([], ["companies.read"])).toBe(false);
  });
});

describe("areOverridesAssignable", () => {
  it("allows granting an override for a permission the actor already holds", () => {
    expect(areOverridesAssignable(["clients.read", "projects.read"], { "clients.read": true })).toBe(true);
  });

  it("rejects granting an override for a permission the actor lacks (privilege escalation)", () => {
    expect(areOverridesAssignable(["projects.read"], { "secrets.reveal": true })).toBe(false);
  });

  it("always allows revoking (false) an override, even for a permission the actor lacks", () => {
    expect(areOverridesAssignable([], { "projects.read": false })).toBe(true);
  });

  it("allows a mix, as long as every grant=true key is held by the actor", () => {
    const actor = ["projects.read", "clients.read"];
    expect(areOverridesAssignable(actor, { "clients.read": true, "deliverables.read": false })).toBe(true);
    expect(areOverridesAssignable(actor, { "clients.read": true, "finance.read": true })).toBe(false);
  });

  it("is vacuously true for an empty overrides object", () => {
    expect(areOverridesAssignable([], {})).toBe(true);
  });
});
