"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { removeMember } from "@/app/actions/team";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { IconTeams } from "@/components/ui/icons";

export interface MemberRow {
  id: string;
  user_id: string;
  status: "active" | "removed";
  joined_at: string;
  user_profiles: { full_name: string | null; email: string | null } | null;
  roles: { label: string } | null;
}

export function MemberTable({
  companyId,
  members,
  canRemove,
}: {
  companyId: string;
  members: MemberRow[];
  canRemove: boolean;
}) {
  const router = useRouter();
  const params = useParams<{ companySlug: string }>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove(membershipId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this company? They will lose access immediately.`)) {
      return;
    }
    setPendingId(membershipId);
    startTransition(async () => {
      try {
        await removeMember({ companyId, membershipId });
        router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  }

  const active = members.filter((m) => m.status === "active");

  if (active.length === 0) {
    return (
      <EmptyState
        icon={<IconTeams width={16} height={16} />}
        title="No team members yet."
        body="Invite people to collaborate in this company."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="ox-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            {canRemove && <th />}
          </tr>
        </thead>
        <tbody>
          {active.map((m) => {
            const name = m.user_profiles?.full_name ?? null;
            const email = m.user_profiles?.email ?? null;
            return (
              <tr key={m.id}>
                <td>
                  <Link
                    href={`/${params.companySlug}/team/${m.user_id}`}
                    className="ox-focus-ring flex items-center gap-2.5 hover:underline"
                  >
                    <Avatar name={name} fallback={email} size={24} />
                    <span>{name ?? "—"}</span>
                  </Link>
                </td>
                <td className="num text-[var(--text-secondary)]">{email ?? "—"}</td>
                <td>
                  <span className="ox-pill ox-pill-neutral">{m.roles?.label ?? "—"}</span>
                </td>
                <td className="num text-[var(--text-muted)]">{new Date(m.joined_at).toLocaleDateString()}</td>
                {canRemove && (
                  <td className="text-right">
                    <button
                      type="button"
                      disabled={isPending && pendingId === m.id}
                      onClick={() => handleRemove(m.id, name ?? email ?? "this member")}
                      className="ox-focus-ring text-[11.5px] font-medium text-[var(--danger)] hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
