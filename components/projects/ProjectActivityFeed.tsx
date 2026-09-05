export interface ActivityRow {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
}

export function ProjectActivityFeed({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">No activity yet.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-4 py-2 text-sm">
          <span className="font-mono text-xs text-[var(--muted)]">
            {new Date(row.created_at).toLocaleString()}
          </span>
          <span>{row.summary}</span>
        </li>
      ))}
    </ul>
  );
}
