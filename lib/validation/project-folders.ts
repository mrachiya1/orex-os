import { z } from "zod";

export const createFolderSchema = z.object({
  organisationId: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(100),
  parentFolderId: z.string().uuid().optional(),
});

export const renameFolderSchema = z.object({
  folderId: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const moveFolderSchema = z.object({
  folderId: z.string().uuid(),
  companyId: z.string().uuid(),
  parentFolderId: z.string().uuid().nullable(),
});

export const archiveFolderSchema = z.object({
  folderId: z.string().uuid(),
  companyId: z.string().uuid(),
});

export const moveProjectToFolderSchema = z.object({
  projectId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
});
