"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeInvitation } from "@/app/actions/team";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTeams } from "@/components/ui/icons";
import { InvitationStatusBadge } from "@/components/team/InvitationStatusBadge";

export interface InvitationRow {
  id: string;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  roles: { label: string } | null;
}

export function InvitationsTable({
  companyId,
  invitations,
  canInvite,
}: {
  companyId: string;
  invitations: InvitationRow[];
  canInvite: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRevoke(invitationId: string, email: string) {
    if (!window.confirm(`Revoke the invitation sent to ${email}? The link will stop working immediately.`)) {
      return;
    }
    setPendingId(invitationId);
    startTransition(async () => {
      try {
        await revokeInvitation({ companyId, invitationId });
        router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  }

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={<IconTeams width={16} height={16} />}
        title="No invitations sent yet."
        body="Invited people will show up here, including ones that have already been accepted or have expired."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="ox-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Invited</th>
            <th>Expires</th>
            {canInvite && <th />}
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <tr key={invitation.id}>
              <td className="text-[var(--text-secondary)]">{invitation.email}</td>
              <td>
                <span className="ox-pill ox-pill-neutral">{invitation.roles?.label ?? "—"}</span>
              </td>
              <td>
                <InvitationStatusBadge status={invitation.status} />
              </td>
              <td className="num text-[var(--text-muted)]">{new Date(invitation.created_at).toLocaleDateString()}</td>
              <td className="num text-[var(--text-muted)]">{new Date(invitation.expires_at).toLocaleDateString()}</td>
              {canInvite && (
                <td className="text-right">
                  {invitation.status === "pending" && (
                    <button
                      type="button"
                      disabled={isPending && pendingId === invitation.id}
                      onClick={() => handleRevoke(invitation.id, invitation.email)}
                      className="ox-focus-ring text-[11.5px] font-medium text-[var(--danger)] hover:underline disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
