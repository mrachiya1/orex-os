import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client bound to the current request's session cookies.
 * Every query through this client is subject to RLS as the authenticated user.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no response to write to;
            // middleware refreshes the session on the next request instead.
          }
        },
      },
    }
  );
}

/**
 * Service-role client that bypasses RLS entirely. Used ONLY for the narrow
 * set of operations that cannot be expressed as a normal user query
 * (granting/revoking organisation_members, writing audit_logs, accepting an
 * invitation by validated token). Every caller of this client MUST perform
 * its own equivalent authorization check in application code first -- see
 * docs/security.md "Database Security". Never import this into a
 * client component or any code that ships to the browser.
 */
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
