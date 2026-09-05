"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProjectMember } from "@/app/actions/project-members";

export function ProjectMemberForm({
  projectId,
  members,
}: {
  projectId: string;
  members: { id: string; full_name: string | null; email: string | null }[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(members[0]?.id ?? "");
  const [projectRole, setProjectRole] = useState("member");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addProjectMember({ projectId, userId, projectRole: projectRole as never });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add member");
      }
    });
  }

  if (members.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 p-4">
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name ?? m.email}
          </option>
        ))}
      </select>
      <select
        value={projectRole}
        onChange={(e) => setProjectRole(e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      >
        {["owner", "lead", "member", "contractor"].map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add member"}
      </button>
      {error && <p className="w-full text-sm text-[var(--danger)]">{error}</p>}
    </form>
  );
}
