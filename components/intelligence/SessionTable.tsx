"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { archiveSession } from "@/app/actions/sessions";

export interface SessionRow {
  id: string;
  title: string;
  goal: string | null;
  status: "active" | "archived";
  created_at: string;
  last_message_at: string;
}

export function SessionTable({ companySlug, sessions }: { companySlug: string; sessions: SessionRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleArchive(sessionId: string, archived: boolean) {
    setPendingId(sessionId);
    startTransition(async () => {
      await archiveSession({ sessionId, archived });
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="ox-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Last activity</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/${companySlug}/intelligence/chat/${s.id}`} className="ox-focus-ring hover:underline">
                  {s.title}
                </Link>
              </td>
              <td>
                <span className={`ox-pill ${s.status === "active" ? "ox-pill-success" : "ox-pill-neutral"}`}>
                  {s.status === "active" ? "Active" : "Archived"}
                </span>
              </td>
              <td className="num text-[var(--text-muted)]">{new Date(s.last_message_at).toLocaleString()}</td>
              <td className="text-right">
                <button
                  type="button"
                  disabled={isPending && pendingId === s.id}
                  onClick={() => toggleArchive(s.id, s.status === "active")}
                  className="ox-focus-ring text-[11.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
                >
                  {s.status === "active" ? "Archive" : "Unarchive"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
