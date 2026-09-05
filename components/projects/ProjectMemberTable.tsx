"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeProjectMember } from "@/app/actions/project-members";

export interface ProjectMemberRow {
  id: string;
  project_role: string;
  status: string;
  user_profiles: { full_name: string | null; email: string | null } | null;
}

export function ProjectMemberTable({
  rows,
  projectId,
  canManage,
}: {
  rows: ProjectMemberRow[];
  projectId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove(membershipId: string) {
    if (!window.confirm("Remove this member from the project?")) return;
    startTransition(async () => {
      await removeProjectMember({ projectId, membershipId });
      router.refresh();
    });
  }

  const active = rows.filter((r) => r.status === "active");
  if (active.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">No project members yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <th className="px-4 py-2 font-medium">Member</th>
          <th className="px-4 py-2 font-medium">Role</th>
          <th className="px-4 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {active.map((row) => (
          <tr key={row.id} className="border-b border-[var(--border)]">
            <td className="px-4 py-2">{row.user_profiles?.full_name ?? row.user_profiles?.email ?? "—"}</td>
            <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">{row.project_role}</td>
            <td className="px-4 py-2">
              {canManage && (
                <button
                  disabled={isPending}
                  onClick={() => remove(row.id)}
                  className="text-xs text-[var(--danger)] disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
