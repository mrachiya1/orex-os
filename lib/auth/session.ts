import "server-only";
import { createServerSupabaseClient } from "@/lib/database/server";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/**
 * Resolves the authenticated user from the verified session. Never trust a
 * client-supplied user id -- this is the only sanctioned way to learn "who
 * is making this request" in server code.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}
