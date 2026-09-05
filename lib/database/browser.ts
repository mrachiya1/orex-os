import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Uses only the public anon key -- safe to ship to
 * the client bundle. All access through this client is still subject to RLS.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
