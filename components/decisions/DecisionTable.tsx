import Link from "next/link";

export interface DecisionRow {
  id: string;
  title: string;
  status: string;
  decision_date: string | null;
  review_date: string | null;
}

export function DecisionTable({ rows, companySlug }: { rows: DecisionRow[]; companySlug: string }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">No decisions recorded yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <th className="px-4 py-2 font-medium">Title</th>
          <th className="px-4 py-2 font-medium">Status</th>
          <th className="px-4 py-2 font-medium">Decision date</th>
          <th className="px-4 py-2 font-medium">Review date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-[var(--border)]">
            <td className="px-4 py-2">
              <Link href={`/${companySlug}/brain/decisions/${row.id}`} className="hover:underline">
                {row.title}
              </Link>
            </td>
            <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">{row.status}</td>
            <td className="px-4 py-2 text-xs text-[var(--muted)]">{row.decision_date ?? "—"}</td>
            <td className="px-4 py-2 text-xs text-[var(--muted)]">{row.review_date ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
