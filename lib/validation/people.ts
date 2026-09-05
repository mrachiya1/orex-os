import { z } from "zod";

export const updateWorkProfileSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().max(120).optional(),
  jobTitle: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  timezone: z.string().max(60).optional(),
  skills: z.array(z.string().max(40)).max(30).optional(),
});

export const updatePrivateProfileSchema = z.object({
  personalEmail: z.string().email().max(200).nullable().optional(),
  personalPhone: z.string().max(40).nullable().optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  privateNotes: z.string().max(2000).nullable().optional(),
});

export const grantCompanyAccessSchema = z.object({
  email: z.string().email(),
  companyId: z.string().uuid(),
  roleId: z.string().uuid(),
});
