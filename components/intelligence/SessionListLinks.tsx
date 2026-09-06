import Link from "next/link";

export interface SessionListRow {
  id: string;
  title: string;
  status: string;
  last_message_at: string;
}

export function SessionListLinks({ companySlug, sessions }: { companySlug: string; sessions: SessionListRow[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link
            href={`/${companySlug}/intelligence/chat/${s.id}`}
            className="ox-focus-ring flex items-center justify-between gap-2 rounded-[var(--radius-s)] px-2 py-1.5 text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
          >
            <span className="truncate">{s.title}</span>
            <span className="shrink-0 text-[10.5px] text-[var(--text-muted)]">
              {new Date(s.last_message_at).toLocaleDateString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
