import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { previewInvitation } from "@/app/actions/team";
import { AcceptInvitationButton, InvitationMismatchPanel, InvitationAuthChoice } from "@/components/auth/InvitationFlow";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [preview, user] = await Promise.all([previewInvitation(token), getCurrentUser()]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-1">
        <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-m)] border border-[var(--border-strong)]">
          <span className="h-2 w-2 rounded-full bg-[var(--text-primary)]" />
        </span>
        <h1 className="mt-2 text-[16px] font-semibold text-[var(--text-primary)]">Orex OS</h1>
      </div>

      <div className="w-full max-w-sm rounded-[var(--radius-l)] border border-[var(--border-medium)] bg-[var(--surface-2)] px-6 py-7">
        {preview.status === "invalid" && <StateMessage title="Invitation not found." body="Check the link or ask for a new one." />}
        {preview.status === "revoked" && <StateMessage title="This invitation is no longer active." body="Ask the founder or your admin to send a new one." />}
        {preview.status === "expired" && <StateMessage title="This invitation has expired." body="Ask the inviter to send a new invitation." />}
        {preview.status === "already_accepted" && (
          <StateMessage
            title="This invitation has already been used."
            body="If that was you, continue to Orex OS below."
            action={
              <Link href={preview.companySlug ? `/${preview.companySlug}` : "/"} className="ox-btn ox-btn-primary mt-3">
                Continue to Orex OS
              </Link>
            }
          />
        )}

        {preview.status === "valid" && (
          <>
            <div className="mb-6 text-center">
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">You&apos;ve been invited to join</p>
              <p className="mt-1 font-display text-[22px] font-medium text-[var(--text-primary)]">{preview.companyName}</p>
              <div className="mt-3 flex justify-center gap-4 text-[12px]">
                <span className="text-[var(--text-muted)]">
                  Role <span className="ml-1 text-[var(--text-secondary)]">{preview.roleLabel}</span>
                </span>
                <span className="text-[var(--text-muted)]">
                  Invited by <span className="ml-1 text-[var(--text-secondary)]">{preview.invitedByName}</span>
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              {user && user.email?.toLowerCase() === preview.email.toLowerCase() ? (
                <AcceptInvitationButton token={token} companyName={preview.companyName} />
              ) : user ? (
                <InvitationMismatchPanel invitedEmail={preview.email} currentEmail={user.email ?? "your current account"} />
              ) : (
                <InvitationAuthChoice
                  token={token}
                  invitedEmail={preview.email}
                  companyName={preview.companyName}
                  roleLabel={preview.roleLabel}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StateMessage({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="text-[12px] text-[var(--text-muted)]">{body}</p>
      {action}
    </div>
  );
}
