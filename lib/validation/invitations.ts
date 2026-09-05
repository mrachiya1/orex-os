import { z } from "zod";

/** Optional per-permission overrides applied on top of the role's default
 * set for this one invitation -- see migration 0031 and role-cap.ts
 * "areOverridesAssignable". Keys must be real catalog permission keys;
 * that's enforced in the server action (this schema only bounds shape). */
export const permissionOverridesSchema = z.record(z.string().min(1).max(60), z.boolean()).refine((obj) => Object.keys(obj).length <= 60, {
  message: "Too many permission overrides.",
});

export const createInvitationSchema = z.object({
  companyId: z.string().uuid(),
  roleId: z.string().uuid(),
  email: z.string().email().max(255),
  permissionOverrides: permissionOverridesSchema.optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(255),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid(),
  companyId: z.string().uuid(),
});
