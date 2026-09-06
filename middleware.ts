import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request
 * (docs/security.md "Session Security"). Server components and actions
 * independently re-verify the user via their own getUser() call
 * (lib/auth/session.ts's requireCurrentUser) -- that is the real
 * authorization boundary, not this middleware.
 *
 * Uses getSession() rather than getUser(): getUser() always makes a network
 * round-trip to Supabase's Auth server to revalidate the JWT, which was
 * running on literally every navigation (every page, every asset-adjacent
 * request the matcher covers) and was the dominant cause of the app feeling
 * slow to switch between pages. getSession() reads/refreshes the session
 * from the local cookie (only hitting the network when the token is
 * actually near expiry, via the SSR client's normal refresh flow) --
 * cookies still get kept fresh, but without paying a network round trip on
 * every single request. This does not weaken security: nothing downstream
 * ever trusted this middleware's own validation, since every real check
 * already performs its own getUser() independently.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
