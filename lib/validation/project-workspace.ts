import { z } from "zod";
import { blockTypes } from "./project-blocks";

export const createSectionSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
});

export const renameSectionSchema = z.object({
  sectionId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
});

export const toggleSectionCollapsedSchema = z.object({
  sectionId: z.string().uuid(),
  projectId: z.string().uuid(),
  isCollapsed: z.boolean(),
});

export const toggleSectionHiddenSchema = z.object({
  sectionId: z.string().uuid(),
  projectId: z.string().uuid(),
  isHidden: z.boolean(),
});

export const moveSectionSchema = z.object({
  sectionId: z.string().uuid(),
  projectId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export const deleteSectionSchema = z.object({
  sectionId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const duplicateSectionSchema = z.object({
  sectionId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const createBlockSchema = z.object({
  projectId: z.string().uuid(),
  sectionId: z.string().uuid(),
  blockType: z.enum(blockTypes),
  content: z.unknown(),
});

export const updateBlockSchema = z.object({
  blockId: z.string().uuid(),
  projectId: z.string().uuid(),
  content: z.unknown(),
});

export const deleteBlockSchema = z.object({
  blockId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const moveBlockSchema = z.object({
  blockId: z.string().uuid(),
  projectId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});
