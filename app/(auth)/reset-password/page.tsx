import { getCurrentUser } from "@/lib/auth/session";
import { SetNewPasswordForm } from "@/components/auth/SetNewPasswordForm";
import { AuthErrorNotice } from "@/components/auth/AuthErrorNotice";

/**
 * Reached only via /auth/callback exchanging a real Supabase recovery-link
 * code for a session -- there is no email/token field on this page itself,
 * updatePassword() acts on whichever session got the person here. Someone
 * who lands here without a session (link expired, already used, or typed
 * the URL directly) gets a plain "sign in" prompt instead of a form that
 * would silently fail.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
        {user?.email && <p className="text-sm text-[var(--muted)]">for {user.email}</p>}
      </div>
      <AuthErrorNotice />
      {user ? (
        <SetNewPasswordForm />
      ) : (
        <p className="max-w-sm text-center text-sm text-[var(--muted)]">
          This reset link has expired or was already used. Request a new one from the sign-in page.
        </p>
      )}
    </div>
  );
}
