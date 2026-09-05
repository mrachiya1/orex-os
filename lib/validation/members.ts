import { z } from "zod";
import { permissionOverridesSchema } from "./invitations";

export const updateMemberPermissionOverridesSchema = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
  permissionOverrides: permissionOverridesSchema,
});

export const removeMemberSchema = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const updateMemberRoleSchema = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const grantOrganisationAccessSchema = z.object({
  organisationId: z.string().uuid(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const revokeOrganisationAccessSchema = z.object({
  organisationId: z.string().uuid(),
  membershipId: z.string().uuid(),
});
