import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/database/server";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/**
 * Resolves the authenticated user from the verified session. Never trust a
 * client-supplied user id -- this is the only sanctioned way to learn "who
 * is making this request" in server code.
 *
 * Wrapped in React.cache() so the layout->page->action chain (which all
 * independently call this) pays for a single auth.getUser() network round
 * trip per request instead of one per call site. This is request-scoped
 * memoization only -- it is never shared across requests or users.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
});

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}
