/**
 * An inviter may only assign a role whose permission set is a subset of
 * their own effective permission set (docs/permissions.md "Invitation
 * Permissions"). Pure function so it can be unit tested without a database.
 */
export function isRoleAssignable(
  inviterPermissionKeys: readonly string[],
  targetRolePermissionKeys: readonly string[]
): boolean {
  const inviterSet = new Set(inviterPermissionKeys);
  return targetRolePermissionKeys.every((key) => inviterSet.has(key));
}

/**
 * Per-member permission overrides (docs/permissions.md, migration 0031):
 * setting an override to `true` grants a permission the target's role
 * wouldn't otherwise give them, so it's an escalation risk exactly like
 * assigning a role -- the actor must already hold that permission
 * themself. Setting an override to `false` only ever restricts the target
 * relative to their role, which is never an escalation, so it's always
 * allowed regardless of what the actor holds.
 */
export function areOverridesAssignable(
  actorPermissionKeys: readonly string[],
  overrides: Readonly<Record<string, boolean>>
): boolean {
  const actorSet = new Set(actorPermissionKeys);
  return Object.entries(overrides).every(([key, granted]) => !granted || actorSet.has(key));
}
