import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/database/server";

/**
 * Exchanges a Supabase magic-link/OAuth PKCE `code` for a real session.
 * This route did not exist before -- without it, `emailRedirectTo` sent the
 * browser back with an unexchanged `?code=`, so the magic-link flow never
 * actually signed anyone in (found while wiring the invitation flow's
 * magic-link option, but it affects the plain /sign-in page's magic-link
 * mode too). `next` is validated to be an in-app relative path only, never
 * an open redirect -- never taken from anything but this same query string
 * Supabase itself round-trips back to us.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
