"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseAuthErrorFragment } from "@/lib/auth/auth-error-fragment";

/**
 * Supabase reports an expired/already-used email link via a URL *fragment*
 * (`#error=...`), which the server never sees -- this only ever runs
 * client-side, on whatever page the browser actually lands on after
 * following the link. Strips the fragment via replaceState once read so a
 * refresh doesn't keep re-showing it.
 */
export function AuthErrorNotice() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // window.location.hash is only available client-side (never during SSR),
    // so this genuinely can't be derived during render without a
    // server/client hydration mismatch -- it must be read post-mount.
    const parsed = parseAuthErrorFragment(window.location.hash);
    if (!parsed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage(parsed.message);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  if (!message) return null;

  return (
    <div className="flex w-full max-w-sm flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
      <p className="text-sm text-[var(--danger)]">{message}</p>
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/sign-in?showForgot=1")}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-black"
        >
          Send a new password reset email
        </button>
        <button
          type="button"
          onClick={() => router.push("/sign-in")}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
