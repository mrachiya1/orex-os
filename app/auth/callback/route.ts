import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/database/server";
import { isSafeInternalPath } from "@/lib/config/app-url";

/**
 * Exchanges a Supabase magic-link/OAuth PKCE `code` for a real session.
 * This route did not exist before -- without it, `emailRedirectTo` sent the
 * browser back with an unexchanged `?code=`, so the magic-link flow never
 * actually signed anyone in (found while wiring the invitation flow's
 * magic-link option, but it affects the plain /sign-in page's magic-link
 * mode too). `next` is validated with the same structural check used
 * everywhere else `APP_URL`-based redirects are built, so this can't become
 * an open redirect even though it's driven by a request-supplied query
 * param -- never taken from anything but this same query string Supabase
 * itself round-trips back to us.
 *
 * The redirect target uses the *request's own* origin (not `APP_URL`)
 * because it must match whatever host actually served this request --
 * `APP_URL` only matters for building the link that gets emailed out in the
 * first place.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const queryErrorCode = searchParams.get("error_code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = isSafeInternalPath(rawNext) ? rawNext : "/";

  // TEMPORARY diagnostic logging for the production recovery-link
  // investigation (2026-09-06) -- never logs the code/token itself, only
  // whether one was present and whether the exchange succeeded. Remove once
  // the fresh recovery-link test confirms the fix.
  if (queryErrorCode) {
    console.error("[auth/callback] Supabase reported an error via query params", { errorCode: queryErrorCode, next });
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[auth/callback]", { hasCode: true, exchangeOk: !error, errorCode: error?.code ?? null, next });
  } else {
    console.log("[auth/callback]", { hasCode: false, next });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
