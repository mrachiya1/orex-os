import { z } from "zod";

export const signInWithPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const signInWithMagicLinkSchema = z.object({
  email: z.string().email(),
});

export const signUpWithPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  fullName: z.string().max(120).optional(),
});
