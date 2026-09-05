import { EmptyState } from "@/components/ui/EmptyState";
import { IconAudit } from "@/components/ui/icons";

export interface AuditRow {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result_status: string;
  created_at: string;
  user_profiles: { full_name: string | null; email: string | null } | null;
}

export function AuditLogTable({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={<IconAudit width={16} height={16} />} title="No audit events yet." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="ox-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Resource</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="num text-[var(--text-muted)]">{new Date(row.created_at).toLocaleString()}</td>
              <td>{row.user_profiles?.full_name ?? row.user_profiles?.email ?? "system"}</td>
              <td className="num text-[var(--text-secondary)]">{row.action}</td>
              <td className="num text-[var(--text-muted)]">
                {row.resource_type}
                {row.resource_id ? `:${row.resource_id.slice(0, 8)}` : ""}
              </td>
              <td>
                <span className={`ox-pill ${row.result_status === "success" ? "ox-pill-success" : "ox-pill-danger"}`}>
                  {row.result_status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
