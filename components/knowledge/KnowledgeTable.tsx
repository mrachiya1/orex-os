import Link from "next/link";
import { VerificationBadge, FreshnessBadge } from "./KnowledgeStatusBadge";

export interface KnowledgeRow {
  id: string;
  title: string;
  item_type: string;
  origin_type: "human" | "ai_extracted" | "system";
  verification_status: "candidate" | "verified" | "rejected";
  lifecycle_status: "current" | "stale" | "superseded" | "archived";
  confidence: number | null;
  updated_at: string;
}

export function KnowledgeTable({ rows, companySlug }: { rows: KnowledgeRow[]; companySlug: string }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--muted)]">No knowledge items yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <th className="px-4 py-2 font-medium">Title</th>
          <th className="px-4 py-2 font-medium">Type</th>
          <th className="px-4 py-2 font-medium">Verification</th>
          <th className="px-4 py-2 font-medium">Freshness</th>
          <th className="px-4 py-2 font-medium">Updated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-[var(--border)]">
            <td className="px-4 py-2">
              <Link href={`/${companySlug}/brain/item/${row.id}`} className="hover:underline">
                {row.title}
              </Link>
            </td>
            <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">{row.item_type}</td>
            <td className="px-4 py-2">
              <VerificationBadge status={row.verification_status} originType={row.origin_type} />
              {row.origin_type === "ai_extracted" && row.confidence != null && (
                <span className="ml-1 text-xs text-[var(--muted)]">
                  ({Math.round(row.confidence * 100)}%)
                </span>
              )}
            </td>
            <td className="px-4 py-2">
              <FreshnessBadge status={row.lifecycle_status} />
            </td>
            <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">
              {new Date(row.updated_at).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
