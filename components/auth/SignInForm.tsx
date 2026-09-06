"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithPassword, signInWithMagicLink, requestPasswordReset } from "@/app/actions/auth";

type Mode = "password" | "magic-link";
type Result = { kind: "error"; message: string } | { kind: "magic-link-sent" } | null;

export function SignInForm({
  allowSignUp = true,
  lockedEmail,
  onMagicLinkRedirect,
  onSignedIn,
}: {
  allowSignUp?: boolean;
  /** When set, the email field is pre-filled and locked -- used inside the
   * invitation flow so an existing user can only sign in as the invited
   * address, never a different one. */
  lockedEmail?: string;
  /** Path to return to after a magic-link click (defaults to app root). */
  onMagicLinkRedirect?: string;
  /** Called instead of the default "push to app root" after a successful
   * password sign-in -- the invitation flow uses this to accept the
   * invitation and land the user in the right company instead. */
  onSignedIn?: () => void;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState(lockedEmail ?? "");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [isPending, startTransition] = useTransition();
  const [showForgot, setShowForgot] = useState(() => searchParams.get("showForgot") === "1");
  const [forgotSent, setForgotSent] = useState(false);
  const [isResetPending, startResetTransition] = useTransition();

  function switchMode(next: Mode) {
    setMode(next);
    setResult(null);
  }

  function submitForgotPassword() {
    startResetTransition(async () => {
      // Always show the same generic confirmation, success or failure --
      // never reveal whether this email has an account (requestPasswordReset
      // itself always returns ok:true; nothing to branch on here).
      await requestPasswordReset({ email });
      setForgotSent(true);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      if (mode === "password") {
        const res = await signInWithPassword({ email, password });
        if (!res.ok) {
          setResult({ kind: "error", message: res.error });
          return;
        }
        if (onSignedIn) {
          onSignedIn();
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        const res = await signInWithMagicLink({ email }, onMagicLinkRedirect);
        if (!res.ok) {
          setResult({ kind: "error", message: res.error });
          return;
        }
        setResult({ kind: "magic-link-sent" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => switchMode("password")}
          className={`px-3 py-1.5 rounded-md border ${mode === "password" ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)]"}`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => switchMode("magic-link")}
          className={`px-3 py-1.5 rounded-md border ${mode === "magic-link" ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)]"}`}
        >
          Magic link
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          disabled={Boolean(lockedEmail)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-70"
        />
      </label>

      {mode === "password" && (
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </label>
      )}

      {mode === "password" && !lockedEmail && !showForgot && (
        <button
          type="button"
          onClick={() => setShowForgot(true)}
          className="self-start text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Forgot password?
        </button>
      )}

      {mode === "password" && showForgot && (
        <div className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
          {forgotSent ? (
            <p className="text-xs text-[var(--success)]">
              If an Orex OS account exists for that email, a password reset link is on its way.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--muted)]">
                We&apos;ll send a reset link to the email above{email ? "" : " (enter it first)"}.
              </p>
              <button
                type="button"
                disabled={isResetPending || !email}
                onClick={submitForgotPassword}
                className="self-start rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {isResetPending ? "Sending…" : "Send reset link"}
              </button>
            </>
          )}
        </div>
      )}

      {result?.kind === "error" && <p className="text-sm text-[var(--danger)]">{result.message}</p>}
      {result?.kind === "magic-link-sent" && (
        <p className="text-sm text-[var(--success)]">Check your email for a sign-in link.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {isPending ? "Working..." : mode === "password" ? "Sign in" : "Send magic link"}
      </button>

      {!allowSignUp && (
        <p className="text-center text-xs text-[var(--muted)]">
          New to Orex OS? Accounts are created through company invitations.
        </p>
      )}
    </form>
  );
}
