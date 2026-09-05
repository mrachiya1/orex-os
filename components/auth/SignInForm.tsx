"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword, signInWithMagicLink } from "@/app/actions/auth";

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
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState(lockedEmail ?? "");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [isPending, startTransition] = useTransition();

  function switchMode(next: Mode) {
    setMode(next);
    setResult(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      try {
        if (mode === "password") {
          await signInWithPassword({ email, password });
          if (onSignedIn) {
            onSignedIn();
          } else {
            router.push("/");
            router.refresh();
          }
        } else {
          await signInWithMagicLink({ email }, onMagicLinkRedirect);
          setResult({ kind: "magic-link-sent" });
        }
      } catch (err) {
        setResult({ kind: "error", message: err instanceof Error ? err.message : "Sign in failed" });
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
