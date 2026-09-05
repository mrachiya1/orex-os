"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/app/actions/team";
import { signUpWithPassword, signOut, resendInvitationConfirmationEmail } from "@/app/actions/auth";
import { SignInForm } from "@/components/auth/SignInForm";

function useAcceptAndRedirect() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function accept(token: string) {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation({ token });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.companySlug ? `/${result.companySlug}` : "/");
      router.refresh();
    });
  }

  return { accept, error, isPending };
}

/**
 * Case A: already signed in with the matching email -- including the
 * moment right after an email-confirmation or magic-link round-trip lands
 * back here via /auth/callback. Accepts automatically rather than making
 * the person click again; a manual retry button appears only if it fails
 * (e.g. the invite expired/was revoked during the round-trip).
 */
export function AcceptInvitationButton({ token, companyName }: { token: string; companyName: string }) {
  const { accept, error, isPending } = useAcceptAndRedirect();

  useEffect(() => {
    accept(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {!error && (
        <>
          <p className="text-[12.5px] text-[var(--success)]">Email confirmed ✓</p>
          <p className="text-[13px] text-[var(--text-secondary)]">Joining {companyName}…</p>
        </>
      )}
      {error && (
        <>
          <p className="ox-error">{error}</p>
          <button type="button" disabled={isPending} onClick={() => accept(token)} className="ox-btn ox-btn-primary w-full max-w-xs">
            {isPending ? "Joining…" : "Try again"}
          </button>
        </>
      )}
    </div>
  );
}

/** Case B: signed in, but with a different email than the invitation. */
export function InvitationMismatchPanel({ invitedEmail, currentEmail }: { invitedEmail: string; currentEmail: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchAccounts() {
    startTransition(async () => {
      await signOut();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-[13px] text-[var(--text-secondary)]">
        This invitation belongs to <span className="font-semibold text-[var(--text-primary)]">{invitedEmail}</span>.
      </p>
      <p className="text-[12px] text-[var(--text-muted)]">
        You&apos;re currently signed in as <span className="text-[var(--text-secondary)]">{currentEmail}</span>.
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={switchAccounts}
        className="ox-btn ox-btn-secondary w-full max-w-xs"
      >
        {isPending ? "Signing out…" : "Sign out and continue with invited account"}
      </button>
    </div>
  );
}

/** Case C: no session yet. Create account / sign in / magic link, all locked to the invited email. */
export function InvitationAuthChoice({
  token,
  invitedEmail,
  companyName,
  roleLabel,
}: {
  token: string;
  invitedEmail: string;
  companyName: string;
  roleLabel: string;
}) {
  const [tab, setTab] = useState<"create" | "sign-in" | "magic-link">("create");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const { accept, error: acceptError, isPending: accepting } = useAcceptAndRedirect();

  if (awaitingConfirmation) {
    return <PendingConfirmationScreen token={token} email={invitedEmail} companyName={companyName} roleLabel={roleLabel} />;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex gap-2 text-[12.5px]">
        <TabButton active={tab === "create"} onClick={() => setTab("create")}>Create account</TabButton>
        <TabButton active={tab === "sign-in"} onClick={() => setTab("sign-in")}>Sign in</TabButton>
        <TabButton active={tab === "magic-link"} onClick={() => setTab("magic-link")}>Email me a link</TabButton>
      </div>

      {tab === "create" && (
        <CreateAccountForm
          token={token}
          invitedEmail={invitedEmail}
          onAccept={() => accept(token)}
          onNeedsConfirmation={() => setAwaitingConfirmation(true)}
          accepting={accepting}
          acceptError={acceptError}
        />
      )}
      {tab === "sign-in" && (
        <SignInForm lockedEmail={invitedEmail} allowSignUp={false} onSignedIn={() => accept(token)} />
      )}
      {tab === "magic-link" && (
        <div className="ox-field">
          <SignInForm lockedEmail={invitedEmail} allowSignUp={false} onMagicLinkRedirect={`/accept-invite/${token}`} />
          <p className="ox-help mt-1">
            The link will bring you back to this invitation, already signed in.
          </p>
        </div>
      )}
      {accepting && <p className="text-[11.5px] text-[var(--text-muted)]">Joining…</p>}
      {acceptError && tab !== "create" && <p className="ox-error">{acceptError}</p>}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius-s)] border px-2.5 py-1.5 ${
        active ? "border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-muted)]"
      }`}
    >
      {children}
    </button>
  );
}

function CreateAccountForm({
  token,
  invitedEmail,
  onAccept,
  onNeedsConfirmation,
  accepting,
  acceptError,
}: {
  token: string;
  invitedEmail: string;
  onAccept: () => void;
  onNeedsConfirmation: () => void;
  accepting: boolean;
  acceptError: string | null;
}) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const res = await signUpWithPassword(
        { email: invitedEmail, password, fullName: fullName || undefined },
        `/accept-invite/${token}`
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.hasSession) {
        onAccept();
      } else {
        onNeedsConfirmation();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="ox-field">
        <label className="ox-label">Email</label>
        <input value={invitedEmail} disabled className="ox-input opacity-70" />
      </div>
      <div className="ox-field">
        <label className="ox-label">Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="ox-input" required />
      </div>
      <div className="ox-field">
        <label className="ox-label">Password</label>
        <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="ox-input" required />
      </div>
      <div className="ox-field">
        <label className="ox-label">Confirm password</label>
        <input type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="ox-input" required />
      </div>
      {error && <p className="ox-error">{error}</p>}
      {acceptError && <p className="ox-error">{acceptError}</p>}
      <button type="submit" disabled={isPending || accepting} className="ox-btn ox-btn-primary">
        {isPending ? "Creating account…" : accepting ? "Joining…" : "Create Orex OS account"}
      </button>
    </form>
  );
}

const RESEND_COOLDOWN_SECONDS = 45;

function PendingConfirmationScreen({
  token,
  email,
  companyName,
  roleLabel,
}: {
  token: string;
  email: string;
  companyName: string;
  roleLabel: string;
}) {
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState<"idle" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  function resend() {
    setSent("idle");
    setErrorMessage(null);
    startTransition(async () => {
      const res = await resendInvitationConfirmationEmail(token);
      if (!res.ok) {
        setSent("error");
        setErrorMessage(res.error);
        return;
      }
      setSent("sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">Check your email</p>
      <p className="text-[12px] text-[var(--text-muted)]">
        We sent a confirmation link to <span className="text-[var(--text-secondary)]">{email}</span>.
      </p>
      <p className="text-[12px] text-[var(--text-muted)]">
        Confirm your email to continue joining <span className="text-[var(--text-secondary)]">{companyName}</span> as{" "}
        <span className="text-[var(--text-secondary)]">{roleLabel}</span>.
      </p>
      <p className="text-[11px] text-[var(--text-muted)]">After confirmation, we&apos;ll bring you back here automatically.</p>

      <a
        href="https://mail.google.com/mail/u/0/"
        target="_blank"
        rel="noreferrer"
        className="ox-btn ox-btn-secondary w-full"
      >
        Open Gmail
      </a>

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled={cooldown > 0 || isPending}
          onClick={resend}
          className="ox-focus-ring text-[11.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          {isPending ? "Sending…" : cooldown > 0 ? `Resend confirmation (${cooldown}s)` : "Didn't receive it? Resend confirmation"}
        </button>
        {sent === "sent" && <p className="text-[11px] text-[var(--success)]">Sent again.</p>}
        {sent === "error" && errorMessage && <p className="ox-error">{errorMessage}</p>}
      </div>
    </div>
  );
}
