import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Orex OS</h1>
        <p className="text-sm text-[var(--muted)]">Sign in to continue</p>
      </div>
      {/* Orex OS is a private company system: account creation is only ever
          reachable through a valid invitation (app/(auth)/accept-invite),
          never from this public page (AGENTS.md "Do NOT allow arbitrary
          public users to register"). */}
      <SignInForm allowSignUp={false} />
    </div>
  );
}
