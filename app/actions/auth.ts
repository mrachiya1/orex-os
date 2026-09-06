"use server";

import { createServerSupabaseClient } from "@/lib/database/server";
import { previewInvitation } from "@/app/actions/team";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  signInWithPasswordSchema,
  signInWithMagicLinkSchema,
  signUpWithPasswordSchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/actions/result";
import { buildAuthCallbackUrl } from "@/lib/config/app-url";

export type { ActionResult } from "@/lib/actions/result";

export async function signInWithPassword(input: unknown): Promise<ActionResult> {
  const parsed = signInWithPasswordSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Only ever reachable through a valid invitation context in the UI (the
 * public /sign-in page hides sign-up entirely -- AGENTS.md "Do NOT allow
 * arbitrary public users to register"). `fullName` flows into
 * raw_user_meta_data, which handle_new_user() (migration 0004) copies into
 * user_profiles.full_name on insert -- no separate profile-write step
 * needed after sign-up.
 *
 * `redirectPath` (the inviting `/accept-invite/[token]` page) is passed
 * through to Supabase's own `emailRedirectTo` on the confirmation email --
 * not stored in localStorage or any other client-side mechanism -- so
 * clicking "Confirm your email" lands back on /auth/callback, which
 * exchanges the code for a session and forwards to that same invitation,
 * where it is fully revalidated before membership is created (never
 * trusted just because it was valid before the confirmation round-trip).
 */
export async function signUpWithPassword(
  input: unknown,
  redirectPath?: string
): Promise<ActionResult<{ hasSession: boolean }>> {
  const parsed = signUpWithPasswordSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      ...(parsed.fullName ? { data: { full_name: parsed.fullName } } : {}),
      emailRedirectTo: buildAuthCallbackUrl(redirectPath),
    },
  });
  if (error) return { ok: false, error: error.message };
  // If email confirmation is required, Supabase returns no session here --
  // the caller (the invitation flow) needs to know so it can show "check
  // your inbox" instead of immediately trying to accept the invitation as
  // an unauthenticated request.
  return { ok: true, hasSession: Boolean(data.session) };
}

/**
 * Resend a signup confirmation email for a pending invitation. Deliberately
 * takes the invitation `token`, never a client-supplied email -- the
 * invitation's own (already-validated) email is what gets resent to, so
 * this can never be used to target an arbitrary address or enumerate
 * whether some other email has an account. Supabase's own per-project rate
 * limiting is the real backstop; the UI adds a client-side cooldown on top
 * so a person can't hammer the button, but that's a UX nicety, not the
 * security boundary.
 */
export async function resendInvitationConfirmationEmail(token: string): Promise<ActionResult> {
  const preview = await previewInvitation(token);
  if (preview.status !== "valid") {
    return { ok: false, error: "This invitation is no longer valid." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: preview.email,
    options: { emailRedirectTo: buildAuthCallbackUrl(`/accept-invite/${token}`) },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * `redirectPath` lets a caller return the user to a specific page (e.g. the
 * invitation they came from) instead of the app root after clicking the
 * magic link -- passed straight to Supabase's own emailRedirectTo, never
 * stored in browser localStorage or any other client-side mechanism.
 */
export async function signInWithMagicLink(input: unknown, redirectPath?: string): Promise<ActionResult> {
  const parsed = signInWithMagicLinkSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.email,
    options: { emailRedirectTo: buildAuthCallbackUrl(redirectPath) },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Always returns the same generic result regardless of whether `email`
 * actually has an Orex OS account (AGENTS.md/account-enumeration rule for
 * this flow: "Never reveal whether an arbitrary account exists"). Supabase
 * itself doesn't leak existence from this call either -- resetPasswordForEmail
 * responds the same way whether or not the address is registered -- so this
 * wrapper mainly exists to (a) route through buildAuthCallbackUrl so the reset
 * link lands on /auth/callback -> /reset-password with a real session, and
 * (b) collapse any transport error into the same generic message rather
 * than surfacing Supabase's own wording, which is one more place existence
 * could theoretically leak. Always returns ok:true on purpose.
 */
export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.email, {
    redirectTo: buildAuthCallbackUrl("/reset-password"),
  });
  // A delivery/transport failure here (e.g. Supabase's shared email sender
  // rate-limiting) is NOT an existence leak -- it happens the same way
  // regardless of whether the address has an account -- so it's safe (and
  // necessary for diagnosing "the email never arrived") to log it
  // server-side. The client-facing message stays generic either way.
  if (error) {
    console.error("resetPasswordForEmail failed", { message: error.message, status: error.status });
  }
  return { ok: true };
}

/**
 * Sets a new password for the CURRENTLY AUTHENTICATED user only -- there is
 * no email/userId parameter, so this can never be pointed at someone else's
 * account. The session that authorizes this call only exists because the
 * person clicked a real Supabase recovery link (or is already signed in);
 * requireCurrentUser() is the enforcement, not a client-supplied identity.
 */
export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = updatePasswordSchema.parse(input);
  await requireCurrentUser();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
